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
          available: availableRef.value,
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
  // Tracks voicings safely committed to data.bin (span mode only — advances
  // once per completed span; stays 0 for standard mode until job is done).
  const availableRef = { value: 0 };
  // Both modes now populate countBySpan
  let countBySpan = null;

  // ---- Shared bucket helpers (used by both modes) -------------------------

  const bucketsDir = path.join(jobDir, "spanBuckets");

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

  function writeSpanManifest() {
    fs.writeFileSync(
      path.join(jobDir, "spanBuckets.json"),
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

  // -------------------------------------------------------------------------

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
      available: totalCountRef.value,
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

  // Standard mode: single-pass, bucket voicings by span on the fly, then
  // concatenate buckets into a span-sorted dataPath — same final layout as
  // span mode but without the 88-pass overhead.

  async function runStandardMode() {
    countBySpan = new Array(88).fill(0);

    fs.mkdirSync(bucketsDir, { recursive: true });

    writeMeta(metaPath, {
      jobId,
      state: "running",
      n,
      count: 0,
      countBySpan,
      createdAt,
    });

    // Per-span staging buffers (one per span, allocated lazily via offset guard)
    const spanPendingBufs = Array.from({ length: 88 }, () =>
      Buffer.allocUnsafe(FLUSH_BYTES)
    );
    const spanPendingOffs = new Int32Array(88); // all zero
    const spanStreams = new Array(88).fill(null);
    let anyStreamError = null;

    function getOrOpenSpanStream(span) {
      if (!spanStreams[span]) {
        const ws = fs.createWriteStream(getBucketPath(span), {
          flags: "w",
          highWaterMark: 1 << 20,
        });
        ws.on("error", (e) => {
          if (!anyStreamError) anyStreamError = e;
        });
        spanStreams[span] = ws;
      }
      return spanStreams[span];
    }

    async function flushSpanBuffer(span) {
      if (spanPendingOffs[span] === 0) return;
      const stream = getOrOpenSpanStream(span);
      const outBuf = spanPendingBufs[span].subarray(0, spanPendingOffs[span]);
      spanPendingOffs[span] = 0;
      if (!stream.write(Buffer.from(outBuf))) {
        await new Promise((resolve, reject) => {
          stream.once("drain", resolve);
          stream.once("error", reject);
        });
      }
      if (anyStreamError) throw anyStreamError;
    }

    // Drain a WASM chunk, routing each voicing to its span bucket.
    async function drainChunkToSpanBuckets(chunk) {
      for (let i = 0; i < chunk.length; ) {
        const len = chunk[i++];
        if (len !== n) {
          throw new Error(
            `Unexpected voicing length ${len} (expected ${n})`
          );
        }

        const start = i;
        const end = i + len;
        if (end > chunk.length) {
          throw new Error(`Truncated record in chunk`);
        }

        // chunk is Int32Array from WASM; notes are sorted ascending
        const span = chunk[end - 1] - chunk[start];

        if (spanPendingOffs[span] + n > spanPendingBufs[span].length) {
          await flushSpanBuffer(span);
        }

        // Narrow int32 → uint8 (MIDI 21-108 fits in one byte)
        for (let j = 0; j < n; j++) {
          spanPendingBufs[span][spanPendingOffs[span]++] = chunk[start + j];
        }

        countBySpan[span]++;
        totalCountRef.value++;
        i = end;

        if ((totalCountRef.value & 8191) === 0) {
          await flushSpanBuffer(span);
          if (anyStreamError) throw anyStreamError;
          writeMeta(metaPath, {
            jobId,
            state: "running",
            n,
            count: totalCountRef.value,
            countBySpan,
            createdAt,
          });
          parentPort.postMessage({ type: "progress", count: totalCountRef.value });
        }
      }
    }

    const gen = await createGenerator(inputNotes, {
      capInts: 2_097_152,
      enableSpanMode: false,
    });

    try {
      for (;;) {
        const { status, chunk } = gen.next();

        if (status !== 0) {
          throw new Error(`WASM nextBatch failed status=${status}`);
        }

        if (!chunk) break;

        await drainChunkToSpanBuckets(chunk);
      }
    } finally {
      gen.close();
    }

    // Flush all remaining per-span buffers
    for (let span = 0; span <= 87; span++) {
      await flushSpanBuffer(span);
    }

    if (anyStreamError) throw anyStreamError;

    // Close all open bucket streams
    await Promise.all(
      spanStreams.map((ws) => {
        if (!ws) return Promise.resolve();
        ws.end();
        return finished(ws).catch(() => {});
      })
    );

    if (anyStreamError) throw anyStreamError;

    await concatBucketsToSingleFile();
    writeSpanManifest();
  }


  // Span mode: 88 passes, one per span. Each completed span's bucket is
  // immediately appended to data.bin so the page endpoint can serve results
  // while the job is still running. No final concat step needed.

  async function runSpanMode() {
    countBySpan = new Array(88).fill(0);

    fs.mkdirSync(bucketsDir, { recursive: true });
    fs.mkdirSync(path.dirname(dataPath), { recursive: true });

    writeMeta(metaPath, {
      jobId,
      state: "running",
      n,
      count: 0,
      available: 0,
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

      // Append this span's bucket to data.bin immediately so pages are
      // readable as each span completes.
      if (countBySpan[span] > 0) {
        await pipeline(
          fs.createReadStream(p),
          fs.createWriteStream(dataPath, { flags: "a" })
        );
      }

      availableRef.value = totalCountRef.value;

      writeMeta(metaPath, {
        jobId,
        state: "running",
        n,
        count: totalCountRef.value,
        available: availableRef.value,
        countBySpan,
        createdAt,
      });

      parentPort.postMessage({
        type: "spanComplete",
        span,
        available: availableRef.value,
      });
    }

    gen.close();
    writeSpanManifest();
  }

})();