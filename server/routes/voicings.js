// server/routes/voicings.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const { Worker } = require("worker_threads");
const { estimateVoicings, generationMode } = require("../lib/noteUtils");
const { decompress } = require("@mongodb-js/zstd");

const router = express.Router();

// ---- Frame-index helpers (span mode compressed data.bin) -------------------

// Parse data.index.bin written by FrameWriter in the worker.
function loadIndex(indexPath) {
  const buf = fs.readFileSync(indexPath);
  let pos = 0;
  const frameRecords = buf.readUInt32LE(pos); pos += 4;
  const frameCount   = buf.readUInt32LE(pos); pos += 4;
  const totalRecords = buf.readUInt32LE(pos); pos += 4;

  const byteOffsets = [];
  for (let i = 0; i <= frameCount; i++) {
    byteOffsets.push(buf.readUInt32LE(pos)); pos += 4;
  }
  const recordCounts = [];
  for (let i = 0; i < frameCount; i++) {
    recordCounts.push(buf.readUInt32LE(pos)); pos += 4;
  }

  // Precompute cumulative record start of each frame for binary search.
  const recordStarts = new Array(frameCount);
  let cum = 0;
  for (let i = 0; i < frameCount; i++) {
    recordStarts[i] = cum;
    cum += recordCounts[i];
  }

  return { frameRecords, frameCount, totalRecords, byteOffsets, recordCounts, recordStarts };
}

// Binary search: largest i such that recordStarts[i] <= recordIdx.
function findFrame(recordStarts, recordIdx) {
  let lo = 0, hi = recordStarts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (recordStarts[mid] <= recordIdx) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

// Read `end - start` records from the frame-indexed compressed data.bin.
// Returns an array of { notes: number[] } objects.
async function readFrameIndexedPage(dataPath, indexPath, start, end, n) {
  const index = loadIndex(indexPath);

  if (index.frameCount === 0 || start >= end) return [];

  const items = [];
  const fd = fs.openSync(dataPath, "r");

  try {
    let recordIdx = start;

    while (recordIdx < end) {
      const frameIdx = findFrame(index.recordStarts, recordIdx);
      const frameStart    = index.recordStarts[frameIdx];
      const frameRecCnt   = index.recordCounts[frameIdx];
      const frameByteOff  = index.byteOffsets[frameIdx];
      const frameByteLen  = index.byteOffsets[frameIdx + 1] - frameByteOff;

      const compressedBuf = Buffer.allocUnsafe(frameByteLen);
      fs.readSync(fd, compressedBuf, 0, frameByteLen, frameByteOff);
      const decompressed = await decompress(compressedBuf);

      const withinStart = recordIdx - frameStart;
      const withinEnd   = Math.min(frameRecCnt, end - frameStart);

      for (let i = withinStart; i < withinEnd; i++) {
        const byteOff = i * n;
        items.push({ notes: Array.from(decompressed.subarray(byteOff, byteOff + n)) });
        recordIdx++;
      }
    }
  } finally {
    fs.closeSync(fd);
  }

  return items;
}

// ----------------------------------------------------------------------------

// Optional in-memory registry. With meta.json on disk, you don't strictly need it.
// Keeping it speeds up status/page without reading disk every time.
const jobs = new Map();

function newJobId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function writeMeta(metaPath, meta) {
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
}

function readMeta(metaPath) {
  return JSON.parse(fs.readFileSync(metaPath, "utf8"));
}

function getJobOrMeta(req, jobId) {
  const job = jobs.get(jobId);
  if (job) return { job, meta: null };

  // best-effort: recover from disk if server restarted
  try {
    const jobDir = path.join(req.app.locals.JOBS_DIR, jobId);
    const metaPath = path.join(jobDir, "meta.json");
    const dataPath = path.join(jobDir, "data.bin");
    if (!fs.existsSync(metaPath)) return { job: null, meta: null };

    const meta = readMeta(metaPath);

    const synthesized = {
      jobId,
      state: meta.state,
      n: meta.n,
      count: meta.count ?? 0,
      available: meta.available ?? (meta.state === "done" ? (meta.count ?? 0) : 0),
      createdAt: meta.createdAt ?? null,
      error: meta.error ?? null,
      jobDir,
      dataPath,
      metaPath,
      worker: null,
    };

    // repopulate in-memory map (helps for subsequent calls)
    jobs.set(jobId, synthesized);
    return { job: synthesized, meta };
  } catch {
    return { job: null, meta: null };
  }
}

/**
 * POST /api/voicings/jobs
 * Body: { notes: number[] , rangeLow, rangeHigh}
 * Returns immediately: { jobId, estimate, mode }
 */
router.post("/jobs", (req, res) => {
  const inputNotes = req.body?.notes;
  const rangeLow = req.body?.rangeLow;
  const rangeHigh = req.body?.rangeHigh;

  console.log("ROUTE body:", req.body);//
  console.log("ROUTE range:", { rangeLow, rangeHigh });//

  if (!Array.isArray(inputNotes) || inputNotes.length === 0) {
    return res.status(400).json({ error: "Body must include { notes: number[] }" });
  }

  const n = inputNotes.length;
  const estimate = estimateVoicings(inputNotes);
  const mode = generationMode(inputNotes);

  const jobId = newJobId();
  const jobDir = path.join(req.app.locals.JOBS_DIR, jobId);
  fs.mkdirSync(jobDir, { recursive: true });

  const dataPath = path.join(jobDir, "data.bin");
  const metaPath = path.join(jobDir, "meta.json");

  const job = {
    jobId,
    state: "running",
    n,
    estimate,
    mode,
    count: 0,
    available: 0,
    createdAt: Date.now(),
    error: null,
    jobDir,
    dataPath,
    metaPath,
    worker: null,
  };

  jobs.set(jobId, job);
  writeMeta(metaPath, {
    jobId,
    state: job.state,
    n: job.n,
    estimate,
    mode,
    count: job.count,
    createdAt: job.createdAt,
  });

  res.json({ jobId, estimate, mode });

  const workerPath = path.join(__dirname, "../workers/voicingsWorker.js");
  const worker = new Worker(workerPath, {
    workerData: {
      jobId,
      inputNotes,
      n,
      estimate,
      mode,
      jobDir,
      dataPath,
      metaPath,
      rangeLow,
      rangeHigh,
    },
  });

  job.worker = worker;

  worker.on("message", (msg) => {
    if (!msg || typeof msg !== "object") return;

    if (msg.type === "progress") {
      job.count = msg.count ?? job.count;
      job.state = "running";
    } else if (msg.type === "spanComplete") {
      job.available = msg.available ?? job.available;
    } else if (msg.type === "done") {
      job.count = msg.count ?? job.count;
      job.available = job.count; // everything is committed
      job.state = "done";
      job.worker = null;
    } else if (msg.type === "error") {
      job.state = "error";
      job.error = msg.error || "Unknown worker error";
      job.worker = null;
    }
  });

  worker.on("error", (err) => {
    job.state = "error";
    job.error = err?.message || String(err);
    job.worker = null;

    try {
      writeMeta(metaPath, {
        jobId,
        state: job.state,
        n: job.n,
        count: job.count,
        createdAt: job.createdAt,
        error: job.error,
      });
    } catch {}
  });

  worker.on("exit", (code) => {
    if (code !== 0 && job.state !== "error" && job.state !== "canceled") {
      job.state = "error";
      job.error = `Worker exited with code ${code}`;
      job.worker = null;

      try {
        writeMeta(metaPath, {
          jobId,
          state: job.state,
          n: job.n,
          count: job.count,
          createdAt: job.createdAt,
          error: job.error,
        });
      } catch {}
    }
  });
});

/**
 * GET /api/voicings/jobs/:jobId/status
 */
router.get("/jobs/:jobId/status", (req, res) => {
  const jobId = req.params.jobId;
  const { job } = getJobOrMeta(req, jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });

  res.json({
    jobId,
    state: job.state,
    n: job.n,
    estimate: job.estimate ?? null,
    mode: job.mode ?? null,
    count: job.count,
    available: job.available ?? 0,
    error: job.error,
  });
});

/**
 * GET /api/voicings/jobs/:jobId/page?offset&limit
 *
 * For span mode: pages are available as each span is committed to data.bin,
 * even while the job is still running. `available` in the response reflects
 * the last fully-committed count and is the safe read ceiling.
 * For standard mode: paging is only available once the job is done.
 *
 * Returns: { jobId, n, offset, available, state, items:[{notes:number[]}] }
 */
router.get("/jobs/:jobId/page", async (req, res) => {
  const jobId = req.params.jobId;
  const { job } = getJobOrMeta(req, jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });

  if (job.state === "error") return res.status(409).json({ error: "Job failed", detail: job.error });
  if (job.state === "canceled") return res.status(410).json({ error: "Job was canceled" });

  // For span mode, pages are available as each span is committed — even while
  // the job is still running. Standard mode gates on done as before.
  const available = job.state === "done"
    ? Math.max(0, job.count || 0)
    : Math.max(0, job.available || 0);

  const isReadable = job.state === "done" || (job.mode === "span" && available > 0);

  if (!isReadable) {
    return res.json({
      jobId,
      n: job.n,
      offset: Math.max(0, parseInt(req.query.offset || "0", 10)),
      items: [],
      state: job.state,
      available: 0,
      note: "Paging is available once the job is done.",
    });
  }

  const offset = Math.max(0, parseInt(req.query.offset || "0", 10));
  const limit = Math.max(1, Math.min(5000, parseInt(req.query.limit || "200", 10)));
  const start = offset;
  const end = Math.min(available, offset + limit);

  if (start >= end) {
    return res.json({ jobId, n: job.n, offset: start, items: [], state: job.state, available });
  }

  if (!fs.existsSync(job.dataPath)) {
    return res.json({ jobId, n: job.n, offset: start, items: [], state: job.state, available: 0 });
  }

  try {
    // Span mode jobs written by the current worker use a frame-indexed
    // compressed data.bin. Older span jobs (or standard mode jobs) use the
    // original flat uncompressed layout — fall back to direct read for those.
    const indexPath = path.join(job.jobDir, "data.index.bin");
    const useFrameIndex = fs.existsSync(indexPath);

    let items;

    if (useFrameIndex) {
      items = await readFrameIndexedPage(job.dataPath, indexPath, start, end, job.n);
    } else {
      // Original direct read — uncompressed fixed-size records.
      const bytesPerVoicing = job.n;
      const byteOffset = start * bytesPerVoicing;
      const byteLength = (end - start) * bytesPerVoicing;

      const fd = fs.openSync(job.dataPath, "r");
      const buf = Buffer.allocUnsafe(byteLength);
      fs.readSync(fd, buf, 0, byteLength, byteOffset);
      fs.closeSync(fd);

      const bytes = new Uint8Array(buf.buffer, buf.byteOffset, byteLength);
      items = [];
      for (let i = 0; i < bytes.length; i += job.n) {
        items.push({ notes: Array.from(bytes.slice(i, i + job.n)) });
      }
    }

    res.json({ jobId, n: job.n, offset: start, items, state: job.state, available });
  } catch (err) {
    res.status(500).json({ error: "Failed to read voicings", detail: err?.message });
  }
});

/**
 * DELETE /api/voicings/jobs/:jobId
 * Best-effort cancel: terminates worker if running, deletes files.
 */
router.delete("/jobs/:jobId", async (req, res) => {
  const jobId = req.params.jobId;
  const { job } = getJobOrMeta(req, jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });

  job.state = "canceled";
  job.error = null;

  if (job.worker) {
    try {
      await job.worker.terminate();
    } catch {}
    job.worker = null;
  }

  try {
    writeMeta(job.metaPath, {
      jobId,
      state: job.state,
      n: job.n,
      count: job.count,
      createdAt: job.createdAt,
    });
  } catch {}

  try {
    fs.rmSync(job.jobDir, { recursive: true, force: true });
  } catch {}

  jobs.delete(jobId);
  res.json({ ok: true });
});

module.exports = router;