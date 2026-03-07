const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const { db, initialize } = require("./database");

const voicingRoutes = require("./routes/voicings");

initialize();

const app = express();

if (process.env.NODE_ENV !== "production") {
  app.use(cors());
}

app.use(express.json({ limit: "1mb" }));

// Jobs dir for future .bin outputs
const JOBS_DIR = path.join(__dirname, "jobs");
fs.mkdirSync(JOBS_DIR, { recursive: true });
app.locals.JOBS_DIR = JOBS_DIR;

app.get("/api/health", (req, res) => {
  const { getFreeGb, formatGb } = require("./lib/diskSpace");
  const freeGb = getFreeGb(JOBS_DIR);
  res.json({
    ok: true,
    disk: {
      freeGb: isFinite(freeGb) ? parseFloat(freeGb.toFixed(2)) : null,
      freeFormatted: formatGb(freeGb),
      rejectThresholdGb: parseFloat(process.env.DISK_REJECT_GB ?? "60"),
      haltThresholdGb:   parseFloat(process.env.DISK_HALT_GB   ?? "30"),
    },
  });
});

app.get("/api/notes", (req, res) => {
  db.all("SELECT * FROM notes", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get("/api/chord-types", (req, res) => {
  db.all("SELECT * FROM chord_types", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.use("/api/voicings", voicingRoutes);

// Serve built React files
app.use(express.static(path.join(__dirname, "public")));

// SPA fallback
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});