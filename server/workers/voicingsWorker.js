// jobs/voicingsWorker.js
const { parentPort, workerData } = require("worker_threads");
const fs = require("fs");
const path = require("path");
const { pipeline } = require("stream/promises");

// IMPORTANT: this module must be importable inside a worker.
const { createGenerator } = require("../wasm/voicingsClient");

function writeMeta(metaPath, meta) {
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
}

function spanOfNotes(notesInt32) {
  // notesInt32 is a view containing ONLY notes (no len), strictly increasing
  const first = notesInt32[0];
  const last = notesInt32[notesInt32.length - 1];
  return last - first;
}

function onceDrain(s) {
  return new Promise((resolve, reject) => {
    s.once("drain", resolve);
    s.once("error", reject);
  });
}

(async () => {
  const { jobId, inputNotes, n, jobDir, dataPath, metaPath } = workerData;

  const createdAt = Date.now();

  // bucket by span while generating, then concatenate buckets into dataPath
  const bucketsDir = path.join(jobDir, "spanBuckets");
  fs.mkdirSync(bucketsDir, { recursive: true });

  // Keep counts by span so we can track progress and debug distribution.
  const countBySpan = new Array(88).fill(0);

  // Limit simultaneously-open file handles
  const MAX_OPEN = 16;
  const streams = new Map(); // span -> WriteStream (LRU)

  function getBucketPath(span) {
    return path.join(bucketsDir, `${String(span).padStart(2, "0")}.bin`);
  }

  function getStream(span) {
    let s = streams.get(span);
    if (s) {
      // refresh LRU
      streams.delete(span);
      streams.set(span, s);
      return s;
    }

    // evict oldest
    if (streams.size >= MAX_OPEN) {
      const [evictSpan, evictStream] = streams.entries().next().value;
      streams.delete(evictSpan);
      evictStream.end();
    }

    const p = getBucketPath(span);
    // Larger writable HWM helps throughput and reduces drain frequency
    s = fs.createWriteStream(p, { flags: "a", highWaterMark: 1 << 20 }); // 1MB
    streams.set(span, s);
    return s;
  }

  async function closeAllStreams() {
    const arr = [...streams.values()];
    streams.clear();
    await Promise.all(
      arr.map(
        (s) =>
          new Promise((resolve, reject) => {
            s.end(resolve);
            s.on("error", reject);
          })
      )
    );
  }

  async function concatBucketsToSingleFile() {
    // Concatenate span buckets in order into the final dataPath.
    // data.bin format: fixed-size records of n int32 notes (NO len prefix),
    // already sorted by span globally via concatenation order.
    fs.mkdirSync(path.dirname(dataPath), { recursive: true });

    const out = fs.createWriteStream(dataPath, { flags: "w" });

    try {
      for (let span = 0; span <= 87; ++span) {
        const p = getBucketPath(span);
        if (!fs.existsSync(p)) continue;

        // Stream-copy bucket -> out without closing out.
        await pipeline(fs.createReadStream(p), out, { end: false });
      }
    } finally {
      await new Promise((resolve, reject) => {
        out.end(resolve);
        out.on("error", reject);
      });
    }
  }

  // -----------------------------
  // Backpressure-safe batching
  // -----------------------------
  const BYTES_PER_RECORD = 4 * n; // n int32 notes, no len prefix
  const RECORDS_PER_FLUSH = 8192; // tune: 8192 records ~= n*4*8192 bytes
  const FLUSH_BYTES = BYTES_PER_RECORD * RECORDS_PER_FLUSH; // e.g. n=8 => 262,144 bytes

  // One staging buffer per span, capped memory:
  // 88 * FLUSH_BYTES (e.g. ~23MB for n=8) + stream internals
  const pendingBufs = new Array(88);
  const pendingOff = new Uint32Array(88);
  for (let span = 0; span < 88; ++span) {
    pendingBufs[span] = Buffer.allocUnsafe(FLUSH_BYTES);
    pendingOff[span] = 0;
  }

  async function flushSpan(span) {
    const off = pendingOff[span];
    if (off === 0) return;

    const s = getStream(span);
    const outBuf = pendingBufs[span].subarray(0, off);
    pendingOff[span] = 0;

    if (!s.write(outBuf)) {
      await onceDrain(s);
    }
  }

  function appendRecord(span, notesInt32) {
    // Copy record bytes into the staging buffer immediately.
    // This also prevents any "view into WASM memory" corruption.
    const src = Buffer.from(
      notesInt32.buffer,
      notesInt32.byteOffset,
      notesInt32.byteLength
    );

    let off = pendingOff[span];
    if (off + src.length > pendingBufs[span].length) {
      return false; // caller must flush then retry
    }
    src.copy(pendingBufs[span], off);
    pendingOff[span] = off + src.length;
    return true;
  }

  async function flushAllPending() {
    // Flush spans that have any buffered bytes.
    // We do it sequentially to avoid too many concurrent drains.
    for (let span = 0; span <= 87; ++span) {
      if (pendingOff[span] !== 0) {
        await flushSpan(span);
      }
    }
  }

  let totalCount = 0;

  try {
    writeMeta(metaPath, {
      jobId,
      state: "running",
      n,
      count: 0,
      countBySpan,
      createdAt,
    });

    // Bigger batch buffer = fewer wasm->js crossings.
    // capInts is number of int32 entries in each returned chunk.
    // 2,097,152 ints = ~8MB.
    const gen = await createGenerator(inputNotes, { capInts: 2_097_152 });

    for (;;) {
      const { status, chunk } = gen.next();

      if (status !== 0) {
        gen.close();
        throw new Error(`WASM nextBatch failed status=${status}`);
      }

      if (!chunk) break; // done

      // Parse records: [len, note1, note2, ...]
      for (let i = 0; i < chunk.length; ) {
        const len = chunk[i++];
        if (!Number.isFinite(len) || len <= 0) {
          gen.close();
          throw new Error(`Invalid record len=${len} at i=${i - 1}`);
        }
        if (len !== n) {
          gen.close();
          throw new Error(`Unexpected voicing length ${len} (expected ${n})`);
        }

        const start = i;
        const end = i + len;
        if (end > chunk.length) {
          gen.close();
          throw new Error(
            `Truncated record: need ${len} notes but only ${chunk.length - i} remain`
          );
        }

        // Notes-only view (fixed record size n)
        const notes = chunk.subarray(start, end);

        // Compute span (0..87) and bucket it
        const span = spanOfNotes(notes);
        if (span < 0 || span > 87) {
          gen.close();
          throw new Error(`Span out of range: ${span}`);
        }

        // Append into per-span staging buffer; flush on overflow.
        if (!appendRecord(span, notes)) {
          await flushSpan(span);
          // must fit now
          if (!appendRecord(span, notes)) {
            gen.close();
            throw new Error(
              `Record too large for staging buffer (span=${span}, bytes=${notes.byteLength})`
            );
          }
        }

        countBySpan[span]++;
        totalCount++;

        i = end;

        // progress + periodic flush to keep buffers bounded even if one span dominates
        if ((totalCount & 8191) === 0) {
          // flush any spans that have accumulated a lot (cheap because most are empty)
          await flushAllPending();

          writeMeta(metaPath, {
            jobId,
            state: "running",
            n,
            count: totalCount,
            countBySpan,
            createdAt,
          });
          parentPort.postMessage({ type: "progress", count: totalCount });
        }
      }
    }

    gen.close();

    // Flush remaining staged bytes to disk
    await flushAllPending();

    // Ensure all bucket streams are flushed to disk
    await closeAllStreams();

    // Combine buckets into the single data file your existing pagination expects
    await concatBucketsToSingleFile();

    // Write a manifest (optional but helpful)
    const manifestPath = path.join(jobDir, "spanBuckets.json");
    fs.writeFileSync(
      manifestPath,
      JSON.stringify(
        {
          jobId,
          n,
          count: totalCount,
          countBySpan,
          createdAt,
          dataPath: path.relative(jobDir, dataPath),
        },
        null,
        2
      )
    );

    writeMeta(metaPath, {
      jobId,
      state: "done",
      n,
      count: totalCount,
      countBySpan,
      createdAt,
    });

    parentPort.postMessage({ type: "done", count: totalCount });
  } catch (err) {
    const error = err?.message || String(err);
    try {
      writeMeta(metaPath, {
        jobId,
        state: "error",
        n,
        count: 0,
        error,
        createdAt: Date.now(),
      });
    } catch {}
    parentPort.postMessage({ type: "error", error });
  }
})();