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
  const { jobId, inputNotes, n, mode, jobDir, dataPath, metaPath } = workerData;

  const createdAt = Date.now();

  // --- Shared staging buffer (uint8 on disk; WASM output stays int32) ---
  const BYTES_PER_RECORD = n; // n uint8 notes (MIDI 21-108 fits in one byte)
  const RECORDS_PER_FLUSH = 8192;
  const FLUSH_BYTES = BYTES_PER_RECORD * RECORDS_PER_FLUSH;

  let pendingBuf = Buffer.allocUnsafe(FLUSH_BYTES);
  let pendingOff = 0;

  function resetPending() {
    pendingOff = 0;
  }

  // Compress int32 MIDI notes (21-108) down to uint8 on the way to disk.
  // WASM output stays int32 — we only narrow at the write boundary.
  function appendRecord(notesInt32) {
    if (pendingOff + n > pendingBuf.length) return false;
    for (let i = 0; i < n; i++) {
      pendingBuf[pendingOff++] = notesInt32[i]; // safe: values are 21-108
    }
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

  // Parse a WASM chunk and write records to `out` stream.
  // Updates totalCount and countBySpan[currentSpan] in place.
  // Returns true if a stream error occurred.
  async function drainChunk(chunk, out, countBySpan, currentSpan, totalCountRef, streamErrorRef) {
    for (let i = 0; i < chunk.length; ) {
      const len = chunk[i++];
      if (len !== n) {
        out.end();
        await finished(out).catch(() => {});
        throw new Error(`Unexpected voicing length ${len} (expected ${n}) span=${currentSpan}`);
      }

      const start = i;
      const end = i + len;
      if (end > chunk.length) {
        out.end();
        await finished(out).catch(() => {});
        throw new Error(`Truncated record in chunk span=${currentSpan}`);
      }

      const notes = chunk.subarray(start, end);

      if (!appendRecord(notes)) {
        await flushPendingToStream(out);
        if (!appendRecord(notes)) {
          out.end();
          await finished(out).catch(() => {});
          throw new Error(`Record too large for staging buffer bytes=${notes.byteLength}`);
        }
      }

      if (countBySpan !== null) countBySpan[currentSpan]++;
      totalCountRef.value++;

      i = end;

      if ((totalCountRef.value & 8191) === 0) {
        await flushPendingToStream(out);
        writeMeta(metaPath, {
          jobId,
          state: "running",
          n,
          count: totalCountRef.value,
          countBySpan: countBySpan ?? [],
          createdAt,
        });
        parentPort.postMessage({ type: "progress", count: totalCountRef.value });
      }

      if (streamErrorRef.value) {
        out.end();
        await finished(out).catch(() => {});
        throw streamErrorRef.value;
      }
    }
  }

  const totalCountRef = { value: 0 };
  let countBySpan = null;

  try {
    if (mode === "span") {
      await runSpanMode();
    } else {
      await runStandardMode();
    }

    writeMeta(metaPath, {
      jobId,
      state: "done",
      n,
      count: totalCountRef.value,
      countBySpan: countBySpan ?? [],
      createdAt,
    });

    parentPort.postMessage({ type: "done", count: totalCountRef.value });

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

  // Standard mode: single-pass, write directly to dataPath.
  // Used for inputs where the estimate is below the span-mode threshold.

  async function runStandardMode() {
    writeMeta(metaPath, {
      jobId,
      state: "running",
      n,
      count: 0,
      countBySpan: [],
      createdAt,
    });

    fs.mkdirSync(path.dirname(dataPath), { recursive: true });

    const out = fs.createWriteStream(dataPath, {
      flags: "w",
      highWaterMark: 1 << 20,
    });

    const streamErrorRef = { value: null };
    out.on("error", (e) => { streamErrorRef.value = e; });

    resetPending();

    const gen = await createGenerator(inputNotes, {
      capInts: 2_097_152,
      enableSpanMode: false,
    });

    for (;;) {
      const { status, chunk } = gen.next();

      if (status !== 0) {
        out.end();
        await finished(out).catch(() => {});
        gen.close();
        throw new Error(`WASM nextBatch failed status=${status}`);
      }

      if (!chunk) break;

      await drainChunk(chunk, out, null, -1, totalCountRef, streamErrorRef);
    }

    gen.close();

    await flushPendingToStream(out);
    out.end();
    await finished(out);

    if (streamErrorRef.value) throw streamErrorRef.value;
  }


  // Span mode: 88 passes, one per span, with per-span bucket files that are
  // concatenated at the end to produce a globally span-sorted dataPath.
  // Used for large inputs where a single-pass hash set would OOM.

  async function runSpanMode() {
    countBySpan = new Array(88).fill(0);

    const bucketsDir = path.join(jobDir, "spanBuckets");
    fs.mkdirSync(bucketsDir, { recursive: true });

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

    writeMeta(metaPath, {
      jobId,
      state: "running",
      n,
      count: 0,
      countBySpan,
      createdAt,
    });

    const gen = await createGenerator(inputNotes, {
      capInts: 2_097_152,
      enableSpanMode: true,
    });

    for (let span = 0; span <= 87; ++span) {
      const st = gen.beginSpan(span);
      if (st !== 0) {
        gen.close();
        throw new Error(`WASM beginSpan(${span}) failed status=${st}`);
      }

      const p = getBucketPath(span);
      const out = fs.createWriteStream(p, {
        flags: "w",
        highWaterMark: 1 << 20,
      });

      const streamErrorRef = { value: null };
      out.on("error", (e) => { streamErrorRef.value = e; });

      resetPending();

      for (;;) {
        const { status, chunk } = gen.next();

        if (status !== 0) {
          out.end();
          await finished(out).catch(() => {});
          gen.close();
          throw new Error(`WASM nextBatch failed status=${status} (span=${span})`);
        }

        if (!chunk) break;

        await drainChunk(chunk, out, countBySpan, span, totalCountRef, streamErrorRef);
      }

      await flushPendingToStream(out);
      out.end();
      await finished(out);

      if (streamErrorRef.value) {
        gen.close();
        throw streamErrorRef.value;
      }
    }

    gen.close();

    await concatBucketsToSingleFile();

    const manifestPath = path.join(jobDir, "spanBuckets.json");
    fs.writeFileSync(
      manifestPath,
      JSON.stringify(
        {
          jobId,
          n,
          count: totalCountRef.value,
          countBySpan,
          createdAt,
          dataPath: path.relative(jobDir, dataPath),
        },
        null,
        2
      )
    );
  }

})();