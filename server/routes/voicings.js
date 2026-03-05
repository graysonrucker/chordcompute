// server/routes/voicings.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const { Worker } = require("worker_threads");
const { estimateVoicings, generationMode } = require("../lib/noteUtils");

const router = express.Router();

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
 * Body: { notes: number[] }
 * Returns immediately: { jobId, estimate, mode }
 */
router.post("/jobs", (req, res) => {
  const inputNotes = req.body?.notes;
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
    },
  });

  job.worker = worker;

  worker.on("message", (msg) => {
    if (!msg || typeof msg !== "object") return;

    if (msg.type === "progress") {
      job.count = msg.count ?? job.count;
      job.state = "running";
    } else if (msg.type === "done") {
      job.count = msg.count ?? job.count;
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
    error: job.error,
  });
});

/**
 * GET /api/voicings/jobs/:jobId/page?offset&limit
 *
 * data.bin is only valid after the job is DONE (span mode concatenates at end;
 * standard mode writes directly but also only marks done on completion).
 *
 * Returns: { jobId, n, offset, items:[{notes:number[]}] }
 */
router.get("/jobs/:jobId/page", (req, res) => {
  const jobId = req.params.jobId;
  const { job } = getJobOrMeta(req, jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });

  if (job.state === "error") return res.status(409).json({ error: "Job failed", detail: job.error });
  if (job.state === "canceled") return res.status(410).json({ error: "Job was canceled" });

  if (job.state !== "done") {
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

  const available = Math.max(0, job.count || 0);
  const start = offset;
  const end = Math.min(available, offset + limit);

  if (start >= end) {
    return res.json({ jobId, n: job.n, offset: start, items: [], state: job.state, available });
  }

  // data.bin is notes-only fixed-size records: n uint8 per voicing (MIDI 21-108)
  const bytesPerVoicing = job.n;
  const byteOffset = start * bytesPerVoicing;
  const byteLength = (end - start) * bytesPerVoicing;

  if (!fs.existsSync(job.dataPath)) {
    return res.json({ jobId, n: job.n, offset: start, items: [], state: job.state, available: 0 });
  }

  const fd = fs.openSync(job.dataPath, "r");
  const buf = Buffer.allocUnsafe(byteLength);
  fs.readSync(fd, buf, 0, byteLength, byteOffset);
  fs.closeSync(fd);

  // Expand uint8 back to regular JS numbers for the response
  const bytes = new Uint8Array(buf.buffer, buf.byteOffset, byteLength);

  const items = [];
  for (let i = 0; i < bytes.length; i += job.n) {
    items.push({ notes: Array.from(bytes.slice(i, i + job.n)) });
  }

  res.json({ jobId, n: job.n, offset: start, items, state: job.state, available });
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