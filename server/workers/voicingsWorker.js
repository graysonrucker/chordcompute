const { parentPort, workerData } = require("worker_threads");
const fs = require("fs");
const path = require("path");

// IMPORTANT: this module must be importable inside a worker.
const { generateFlat } = require("../wasm/voicingsClient");

function writeMeta(metaPath, meta) {
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
}

(async () => {
  const { jobId, inputNotes, n, jobDir, dataPath, metaPath } = workerData;

  try {
    writeMeta(metaPath, { jobId, state: "running", n, count: 0, createdAt: Date.now() });

    const { status, flat } = await generateFlat(inputNotes);
    if (status !== 0 || !flat) throw new Error(`WASM failed status=${status}`);

    const out = fs.createWriteStream(dataPath, { flags: "w" });

    let count = 0;
    for (let i = 0; i < flat.length; ) {
      const len = flat[i++];
      if (!Number.isFinite(len) || len <= 0) break;
      if (len !== n) throw new Error(`Unexpected voicing length ${len} (expected ${n})`);

      const slice = flat.slice(i, i + len);
      i += len;

      const buf = Buffer.from(slice.buffer, slice.byteOffset, slice.byteLength);
      out.write(buf);

      count++;

      // optional: update meta occasionally so status/page can see progress
      if ((count & 8191) === 0) {
        writeMeta(metaPath, { jobId, state: "running", n, count, createdAt: Date.now() });
        parentPort.postMessage({ type: "progress", count });
      }
    }

    await new Promise((resolve, reject) => {
      out.end(resolve);
      out.on("error", reject);
    });

    writeMeta(metaPath, { jobId, state: "done", n, count, createdAt: Date.now() });
    parentPort.postMessage({ type: "done", count });
  } catch (err) {
    const error = err?.message || String(err);
    try {
      writeMeta(metaPath, { jobId, state: "error", n, count: 0, error, createdAt: Date.now() });
    } catch {}
    parentPort.postMessage({ type: "error", error });
  }
})();