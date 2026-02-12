const express = require('express');
const cors = require('cors');
const { db, initialize } = require('./database');

initialize();

const app = express();
app.use(cors());
app.use(express.json()); // <-- IMPORTANT: so POST bodies work

// ---------- helpers ----------
function uniqSorted(nums) {
  return [...new Set(nums)].sort((a, b) => a - b);
}

function pcsFromNotes(notes) {
  // safe mod (handles negatives if they ever happen)
  const pcs = notes.map(n => ((n % 12) + 12) % 12);
  return uniqSorted(pcs);
}

function containsAllPitchClasses(voicingNotes, pcsNeed) {
  const have = new Set(voicingNotes.map(n => ((n % 12) + 12) % 12));
  return pcsNeed.every(pc => have.has(pc));
}

function combinations(arr, k) {
  const out = [];
  const n = arr.length;

  function backtrack(start, combo) {
    if (combo.length === k) {
      out.push(combo.slice());
      return;
    }
    for (let i = start; i <= n - (k - combo.length); i++) {
      combo.push(arr[i]);
      backtrack(i + 1, combo);
      combo.pop();
    }
  }

  backtrack(0, []);
  return out;
}

function scoreVoicing(notes) {
  // smaller span is better; fewer doublings is better
  const span = notes[notes.length - 1] - notes[0];

  const pcs = notes.map(n => ((n % 12) + 12) % 12);
  const counts = new Map();
  for (const pc of pcs) counts.set(pc, (counts.get(pc) || 0) + 1);

  let doublingPenalty = 0;
  for (const c of counts.values()) doublingPenalty += Math.max(0, c - 1);

  // weighted score: span dominates, doublings secondary
  return span * 10 + doublingPenalty * 3;
}
// -----------------------------

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

/**
 * POST /api/voicings
 * Body:
 * {
 *   "notes": [35,39,47],
 *   "rangeLow": 48,
 *   "rangeHigh": 72,
 *   "minNotes": 3,
 *   "maxNotes": 5,
 *   "maxSpan": 16,
 *   "limit": 200
 * }
 */
app.post('/api/voicings', (req, res) => {
  const input = req.body;

  if (!input || !Array.isArray(input.notes) || input.notes.length === 0) {
    return res.status(400).json({ error: "Body must include { notes: number[] }" });
  }

  // sanitize notes
  const notes = uniqSorted(
    input.notes
      .map(Number)
      .filter(n => Number.isFinite(n))
  );

  if (notes.length === 0) {
    return res.status(400).json({ error: "No valid numeric notes provided." });
  }

  const pcsNeed = pcsFromNotes(notes);

  // defaults (safe MVP)
  const rangeLow = Number.isFinite(input.rangeLow) ? input.rangeLow : 48;
  const rangeHigh = Number.isFinite(input.rangeHigh) ? input.rangeHigh : 72;
  const minNotes = Number.isFinite(input.minNotes) ? input.minNotes : 3;
  const maxNotes = Number.isFinite(input.maxNotes) ? input.maxNotes : 5;
  const maxSpan = Number.isFinite(input.maxSpan) ? input.maxSpan : 16;
  const limit = Number.isFinite(input.limit) ? Math.min(input.limit, 1000) : 200;

  if (rangeHigh < rangeLow) {
    return res.status(400).json({ error: "rangeHigh must be >= rangeLow" });
  }
  if (minNotes < 1 || maxNotes < minNotes) {
    return res.status(400).json({ error: "Invalid minNotes/maxNotes" });
  }

  // build candidate notes in the output range belonging to chord pitch classes
  const candidates = [];
  for (let n = rangeLow; n <= rangeHigh; n++) {
    const pc = ((n % 12) + 12) % 12;
    if (pcsNeed.includes(pc)) candidates.push(n);
  }

  // generate, filter, rank
  const results = [];

  // HARD safety valve: stop if combos get ridiculous
  const COMBO_CAP = 300000; // adjust later
  let generated = 0;

  for (let k = minNotes; k <= maxNotes; k++) {
    const combs = combinations(candidates, k);
    generated += combs.length;
    if (generated > COMBO_CAP) break;

    for (const v of combs) {
      const span = v[v.length - 1] - v[0];
      if (span > maxSpan) continue;
      if (!containsAllPitchClasses(v, pcsNeed)) continue;

      results.push({
        notes: v,
        span,
        score: scoreVoicing(v),
      });
    }
  }

  results.sort((a, b) => a.score - b.score);

  res.json({
    input: { notes, pcsNeed, rangeLow, rangeHigh, minNotes, maxNotes, maxSpan, limit },
    totalFound: results.length,
    voicings: results.slice(0, limit),
    truncatedBecauseComboCap: generated > COMBO_CAP
  });
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});