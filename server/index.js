const express = require('express');
const cors = require('cors');
const path = require('path');
const { db, initialize } = require('./database');

const voicingRoutes = require("./routes/voicings");

initialize();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/notes', (req, res) => {
  db.all("SELECT * FROM notes", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/chord-types', (req, res) => {
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

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});