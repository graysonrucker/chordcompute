// spanWorker.js
// Pure compute worker: owns one WASM generator instance, processes one span
// at a time on demand.
//
// Protocol (messages from parent → this worker):
//   { type: 'run', span: number }
//     → runs beginSpan(span), streams records back in fixed-size chunks,
//       then posts spanDone. Worker memory is bounded to one chunk at a time.
//   { type: 'close' }
//     → frees WASM resources and exits
//
// Protocol (messages this worker → parent):
//   { type: 'ready' }
//     → WASM initialised, ready to receive 'run' messages
//   { type: 'chunk', span, records: ArrayBuffer, count }
//     → packed uint8 buffer of `count` records (n bytes each), transferred zero-copy
//   { type: 'spanDone', span, totalCount }
//     → span fully drained; no more chunks will follow for this span
//   { type: 'error', span?, error: string }
//     → fatal error for this span (or during init)

"use strict";

const { parentPort, workerData } = require("worker_threads");
const { createGenerator } = require("../wasm/voicingsClient");

const { inputNotes, n, rangeLow, rangeHigh } = workerData;

// Number of records to accumulate before posting a chunk back.
// Large enough to amortise IPC overhead; small enough to keep memory flat.
const CHUNK_RECORDS = 8192;

(async () => {
  let gen;

  try {
    gen = await createGenerator(inputNotes, {
      capInts: 2_097_152,
      enableSpanMode: true,
      rangeLow,
      rangeHigh,
    });
  } catch (err) {
    parentPort.postMessage({ type: "error", error: err?.message || String(err) });
    return;
  }

  parentPort.postMessage({ type: "ready" });

  parentPort.on("message", async (msg) => {
    if (msg.type === "run") {
      const span = msg.span;

      try {
        const st = gen.beginSpan(span);
        if (st !== 0) throw new Error(`beginSpan(${span}) failed status=${st}`);

        // Reusable staging buffer — one chunk at a time.
        let stageBuf   = new Uint8Array(CHUNK_RECORDS * n);
        let stageCount = 0;
        let totalCount = 0;

        function flushChunk() {
          if (stageCount === 0) return;
          // Slice out only the filled portion and transfer it.
          const out = new Uint8Array(stageCount * n);
          out.set(stageBuf.subarray(0, stageCount * n));
          parentPort.postMessage(
            { type: "chunk", span, records: out.buffer, count: stageCount },
            [out.buffer]
          );
          totalCount += stageCount;
          stageCount  = 0;
          // stageBuf is still valid (we copied into `out`); reuse it.
        }

        for (;;) {
          const { status, chunk } = gen.next();
          if (status !== 0) throw new Error(`nextBatch failed status=${status} span=${span}`);
          if (!chunk) break;

          // chunk is Int32Array: [len, note0, note1, ...] repeated
          for (let i = 0; i < chunk.length; ) {
            const len = chunk[i++];
            const off = stageCount * n;
            for (let j = 0; j < len; j++) stageBuf[off + j] = chunk[i++]; // int32 → uint8
            stageCount++;

            if (stageCount === CHUNK_RECORDS) flushChunk();
          }
        }

        flushChunk(); // flush any remaining partial chunk

        parentPort.postMessage({ type: "spanDone", span, totalCount });

      } catch (err) {
        parentPort.postMessage({
          type: "error",
          span,
          error: err?.message || String(err),
        });
      }

    } else if (msg.type === "close") {
      try { gen.close(); } catch {}
      process.exit(0);
    }
  });
})();