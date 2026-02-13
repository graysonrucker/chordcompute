const express = require('express');
const cors = require('cors');
const { db, initialize } = require('./database');

const voicingRoutes = require("./routes/voicings");

initialize();

const app = express();
app.use(cors());
app.use(express.json());

// simple DB routes stay here (or can be moved later)
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

// voicings route mounted here
app.use("/api/voicings", voicingRoutes);

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});