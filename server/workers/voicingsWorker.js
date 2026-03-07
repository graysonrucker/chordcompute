// jobs/voicingsWorker.js
const { parentPort, workerData } = require("worker_threads");
const fs = require("fs");
const path = require("path");
const { pipeline } = require("stream/promises");
const { finished } = require("stream/promises");

// IMPORTANT: this module must be importable inside a worker.
const { createGenerator } = require("../wasm/voicingsClient");
const { compress, decompress } = require("@mongodb-js/zstd");

// Number of uncompressed records accumulated into one zstd frame in data.bin.
// Larger = better compression; smaller = less decompression work per page read.
// 4096 is a good balance (~40KB uncompressed for n=10, decompresses in ~100µs).
const FRAME_RECORDS = 4096;
const ZSTD_LEVEL = 3;

function writeMeta(metaPath, meta) {
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
}

(async () => {
  const { jobId, inputNotes, n, mode, jobDir, dataPath, metaPath, rangeLow, rangeHigh } = workerData;

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

  // ---- FrameWriter -----------------------------------------------------------
  // Accumulates uint8 records into fixed-size frames, compresses each frame
  // with zstd, and appends it to data.bin. Maintains a parallel index file
  // (data.index.bin) so the page endpoint can seek directly to any frame.
  //
  // Index binary layout (all uint32 LE):
  //   [FRAME_RECORDS, frameCount, totalRecords,
  //    byteOffset[0..frameCount],          // frameCount+1 entries; last = file size
  //    recordCount[0..frameCount-1]]       // records in each frame (may be < FRAME_RECORDS
  //                                        // at span boundaries)
  //
  // Note: byte offsets are uint32, which supports up to ~4 GB of compressed data.
  // Jobs approaching that size should not arise in practice given current inputs.

  class FrameWriter {
    constructor(dataPath, indexPath, recordSize) {
      this.indexPath = indexPath;
      this.recordSize = recordSize;

      // Frame accumulation buffer
      this.frameBuf = Buffer.allocUnsafe(FRAME_RECORDS * recordSize);
      this.frameBufRecords = 0;

      // Index state
      this.byteOffsets = [0]; // byteOffsets[i] = start of frame i; [frameCount] = file size
      this.recordCounts = []; // records in frame i
      this.committedRecords = 0;
      this.hasPendingWrite = false; // true once any frame has been flushed

      this.dataFd = fs.openSync(dataPath, "w");
    }

    // Push one record (a Buffer/Uint8Array slice of exactly recordSize bytes).
    async pushRecordBytes(src) {
      src.copy(this.frameBuf, this.frameBufRecords * this.recordSize);
      this.frameBufRecords++;
      if (this.frameBufRecords === FRAME_RECORDS) {
        await this._flushFrame();
      }
    }

    // Compress and write the current buffer (full or partial) as one frame.
    async _flushFrame() {
      if (this.frameBufRecords === 0) return;
      const uncompressed = this.frameBuf.subarray(0, this.frameBufRecords * this.recordSize);
      const compressed = await compress(uncompressed, ZSTD_LEVEL);

      fs.writeSync(this.dataFd, compressed);
      const prevOffset = this.byteOffsets[this.byteOffsets.length - 1];
      this.byteOffsets.push(prevOffset + compressed.length);
      this.recordCounts.push(this.frameBufRecords);
      this.committedRecords += this.frameBufRecords;
      this.frameBufRecords = 0;
      this.hasPendingWrite = true;
    }

    // Called at each span boundary: flush whatever is buffered, then fsync so
    // the page endpoint can safely read up to committedRecords.
    async sealSpan() {
      await this._flushFrame();
      if (this.hasPendingWrite) {
        fs.fsyncSync(this.dataFd);
        this.hasPendingWrite = false;
      }
      // Write the index after every span so the page endpoint can use it
      // immediately during streaming, before finalize() is called.
      this._writeIndex();
    }

    // Flush remaining records, close the data file, write the index.
    async finalize() {
      await this._flushFrame();
      fs.fsyncSync(this.dataFd);
      fs.closeSync(this.dataFd);
      this.dataFd = -1;
      this._writeIndex();
    }

    _writeIndex() {
      const frameCount = this.recordCounts.length;
      // 3 header words + (frameCount+1) byte offsets + frameCount record counts
      const buf = Buffer.allocUnsafe((3 + frameCount + 1 + frameCount) * 4);
      let pos = 0;
      buf.writeUInt32LE(FRAME_RECORDS, pos); pos += 4;
      buf.writeUInt32LE(frameCount, pos); pos += 4;
      buf.writeUInt32LE(this.committedRecords, pos); pos += 4;
      for (const off of this.byteOffsets) { buf.writeUInt32LE(off, pos); pos += 4; }
      for (const cnt of this.recordCounts) { buf.writeUInt32LE(cnt, pos); pos += 4; }
      fs.writeFileSync(this.indexPath, buf);
    }
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
      rangeLow,
      rangeHigh,
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


  // -------------------------------------------------------------------------

  // Span mode: 88 passes, one per span, distributed across a small pool of
  // span compute workers (spanWorker.js). Each worker owns its own WASM
  // instance so spans run in parallel.
  //
  // Results arrive out of order; this coordinator buffers completed spans and
  // commits them to FrameWriter in strict ascending order so that `available`
  // advances contiguously and the client can page results as they stream in.
  //
  // With NUM_WORKERS=2 the worst-case buffer is one span's records held in
  // memory (when worker 2 finishes span N+1 before worker 1 finishes span N).
  // This is a modest memory overhead in exchange for meaningful parallelism on
  // the larger mid-range spans.

  async function runSpanMode() {
    countBySpan = new Array(88).fill(0);

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

    const indexPath = path.join(jobDir, "data.index.bin");
    const frameWriter = new FrameWriter(dataPath, indexPath, n);

    // --- Spawn span compute workers -----------------------------------------

    const NUM_WORKERS = 2;
    const spanWorkerPath = path.join(__dirname, "spanWorker.js");
    const { Worker: SpanWorker } = require("worker_threads");

    const pool = [];
    for (let i = 0; i < NUM_WORKERS; i++) {
      const w = new SpanWorker(spanWorkerPath, {
        workerData: { inputNotes, n, rangeLow, rangeHigh },
      });

      // Wait for the worker's WASM instance to initialise before proceeding.
      await new Promise((resolve, reject) => {
        w.once("message", (msg) => {
          if (msg.type === "ready") resolve();
          else reject(new Error(msg.error || "Unexpected message during span worker init"));
        });
        w.once("error", reject);
      });

      pool.push({ worker: w, busy: false });
    }

    // --- Ordered-commit coordinator -----------------------------------------
    //
    // Workers stream records back in fixed-size chunks which are immediately
    // written to per-span temp files — memory stays flat regardless of span
    // size. When a span is fully done, tryCommit() reads its temp file into
    // FrameWriter in strict ascending order so `available` advances
    // contiguously for the client.

    // Per-span state: temp file path, sync write fd, record count, done flag.
    const spanState = new Map();

    fs.mkdirSync(bucketsDir, { recursive: true });

    function getOrOpenSpan(span) {
      const existing = spanState.get(span);
      if (existing && existing.fd >= 0) return existing;

      const tmpPath = getBucketPath(span);
      const fd = fs.openSync(tmpPath, existing ? "a" : "w");
      const state = { tmpPath, fd, recordCount: existing?.recordCount ?? 0, done: false };
      spanState.set(span, state);
      return state;
    }

    let nextToDispatch = 0;
    let nextToCommit   = 0;
    const maxSpan      = rangeHigh - rangeLow;

    // Commit all contiguous completed spans starting from nextToCommit.
    let committing = false;

    async function tryCommit() {
      if (committing) return;
      committing = true;
      try {
        while (true) {
          const state = spanState.get(nextToCommit);
          if (!state || !state.done) break;

          const { tmpPath, recordCount } = state;
          const span = nextToCommit;

          // Close the write fd before reading.
          fs.closeSync(state.fd);
          state.fd = -1;

          countBySpan[span] = recordCount;
          totalCountRef.value += recordCount;

          // Stream temp file into FrameWriter in chunks to keep read memory flat.
          if (recordCount > 0) {
            const READ_CHUNK = 4096; // records per read
            const readBuf = Buffer.allocUnsafe(READ_CHUNK * n);
            const readFd  = fs.openSync(tmpPath, "r");
            let pos = 0;

            try {
              for (;;) {
                const bytesRead = fs.readSync(readFd, readBuf, 0, readBuf.length, pos);
                if (bytesRead === 0) break;
                const recs = bytesRead / n;
                for (let r = 0; r < recs; r++) {
                  await frameWriter.pushRecordBytes(Buffer.from(readBuf.buffer, readBuf.byteOffset + r * n, n));
                }
                pos += bytesRead;
              }
            } finally {
              fs.closeSync(readFd);
            }
          }

          // Delete temp file — data is now in FrameWriter.
          try { fs.unlinkSync(tmpPath); } catch {}
          spanState.delete(span);

          await frameWriter.sealSpan();
          availableRef.value = frameWriter.committedRecords;

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

          nextToCommit++;
        }
      } finally {
        committing = false;
      }
      // A spanDone may have arrived while we were awaiting — re-check.
      if (spanState.get(nextToCommit)?.done) await tryCommit();
    }

    // --- Dispatch loop -------------------------------------------------------

    await new Promise((resolve, reject) => {
      let fatalError = null;

      function dispatch() {
        if (fatalError) return;

        for (const slot of pool) {
          if (!slot.busy && nextToDispatch <= maxSpan) {
            const span = nextToDispatch++;
            slot.busy = true;
            slot.worker.postMessage({ type: "run", span });
          }
        }

        if (nextToDispatch > maxSpan && nextToCommit > maxSpan) resolve();
      }

      for (const slot of pool) {
        slot.worker.on("message", async (msg) => {
          if (fatalError) return;

          if (msg.type === "chunk") {
            // Append chunk directly to temp file — zero memory accumulation.
            try {
              const state = getOrOpenSpan(msg.span);
              const buf = Buffer.from(msg.records);
              fs.writeSync(state.fd, buf);
              state.recordCount += msg.count;
            } catch (err) {
              fatalError = err;
              reject(err);
            }

          } else if (msg.type === "spanDone") {
            slot.busy = false;
            const state = getOrOpenSpan(msg.span);
            state.done = true;

            try {
              await tryCommit();
            } catch (err) {
              fatalError = err;
              reject(err);
              return;
            }

            dispatch();

          } else if (msg.type === "error") {
            fatalError = new Error(msg.error || `Span worker error (span=${msg.span ?? "?"})`);
            reject(fatalError);
          }
        });

        slot.worker.on("error", (err) => {
          if (!fatalError) { fatalError = err; reject(err); }
        });
      }

      dispatch(); // kick off initial assignments
    });

    // --- Cleanup ------------------------------------------------------------

    for (const slot of pool) {
      try { slot.worker.postMessage({ type: "close" }); } catch {}
    }

    await frameWriter.finalize();
    writeSpanManifest();
  }

})();