// jobs/voicingsWorker.js
const { parentPort, workerData } = require("worker_threads");
const fs = require("fs");
const path = require("path");
const { pipeline } = require("stream/promises");
const { finished } = require("stream/promises");

// IMPORTANT: this module must be importable inside a worker.
const { createGenerator } = require("../wasm/voicingsClient");

function writeMeta(metaPath, meta) {
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
}

(async () => {
  const { jobId, inputNotes, n, jobDir, dataPath, metaPath } = workerData;

  const createdAt = Date.now();

  // One bucket file per span, then concatenate into dataPath.
  const bucketsDir = path.join(jobDir, "spanBuckets");
  fs.mkdirSync(bucketsDir, { recursive: true });

  const countBySpan = new Array(88).fill(0);

  function getBucketPath(span) {
    return path.join(bucketsDir, `${String(span).padStart(2, "0")}.bin`);
  }

  async function concatBucketsToSingleFile() {
    fs.mkdirSync(path.dirname(dataPath), { recursive: true });
    const out = fs.createWriteStream(dataPath, { flags: "w" });

    try {
      for (let span = 0; span <= 87; ++span) {
        const p = getBucketPath(span);
        if (!fs.existsSync(p)) continue;

        await pipeline(fs.createReadStream(p), out, { end: false });
      }
    } finally {
      await new Promise((resolve, reject) => {
        out.end(resolve);
        out.on("error", reject);
      });
    }
  }

  const BYTES_PER_RECORD = 4 * n; // n int32 notes (no len prefix on disk)
  const RECORDS_PER_FLUSH = 8192;
  const FLUSH_BYTES = BYTES_PER_RECORD * RECORDS_PER_FLUSH;

  let pendingBuf = Buffer.allocUnsafe(FLUSH_BYTES);
  let pendingOff = 0;

  function resetPending() {
    pendingOff = 0;
  }

  function appendRecord(notesInt32) {
    const src = Buffer.from(
      notesInt32.buffer,
      notesInt32.byteOffset,
      notesInt32.byteLength
    );

    if (pendingOff + src.length > pendingBuf.length) return false;
    src.copy(pendingBuf, pendingOff);
    pendingOff += src.length;
    return true;
  }

  async function flushPendingToStream(stream) {
    if (pendingOff === 0) return;

    const outBuf = pendingBuf.subarray(0, pendingOff);
    pendingOff = 0;

    if (!stream.write(outBuf)) {
      await new Promise((resolve, reject) => {
        stream.once("drain", resolve);
        stream.once("error", reject);
      });
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

    // Create generator in span mode (no begin yet). We'll call gen.beginSpan(span).
    const gen = await createGenerator(inputNotes, {
      capInts: 2_097_152,
      enableSpanMode: true,
    });

    for (let span = 0; span <= 87; ++span) {
      // Reset WASM generator for this span (clears knownStructures inside WASM)
      const st = gen.beginSpan(span);
      if (st !== 0) {
        gen.close();
        throw new Error(`WASM beginSpan(${span}) failed status=${st}`);
      }

      // Open a single stream for this span; attach ONE error listener.
      const p = getBucketPath(span);
      const out = fs.createWriteStream(p, {
        flags: "w",
        highWaterMark: 1 << 20,
      });

      let streamError = null;
      out.on("error", (e) => {
        streamError = e;
      });

      resetPending();

      for (;;) {
        const { status, chunk } = gen.next();

        if (status !== 0) {
          out.end();
          await finished(out).catch(() => {});
          gen.close();
          throw new Error(`WASM nextBatch failed status=${status} (span=${span})`);
        }

        if (!chunk) break; // done with this span

        // Parse records: [len, note1..noteN] repeated (len should always be n)
        for (let i = 0; i < chunk.length; ) {
          const len = chunk[i++];
          if (len !== n) {
            out.end();
            await finished(out).catch(() => {});
            gen.close();
            throw new Error(
              `Unexpected voicing length ${len} (expected ${n}) span=${span}`
            );
          }

          const start = i;
          const end = i + len;
          if (end > chunk.length) {
            out.end();
            await finished(out).catch(() => {});
            gen.close();
            throw new Error(`Truncated record in chunk span=${span}`);
          }

          const notes = chunk.subarray(start, end);

          // Append notes-only record (fixed n int32) to the current span file
          if (!appendRecord(notes)) {
            await flushPendingToStream(out);
            if (!appendRecord(notes)) {
              out.end();
              await finished(out).catch(() => {});
              gen.close();
              throw new Error(
                `Record too large for staging buffer bytes=${notes.byteLength}`
              );
            }
          }

          countBySpan[span]++;
          totalCount++;

          i = end;

          // progress + periodic flush
          if ((totalCount & 8191) === 0) {
            await flushPendingToStream(out);

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

          if (streamError) {
            out.end();
            await finished(out).catch(() => {});
            gen.close();
            throw streamError;
          }
        }
      }

      // Flush remaining staged bytes for this span and close the stream
      await flushPendingToStream(out);
      out.end();
      await finished(out);

      if (streamError) {
        gen.close();
        throw streamError;
      }
    }

    gen.close();

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