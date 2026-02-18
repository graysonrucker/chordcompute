// server/lib/voicings.js

/*curl -X POST http://localhost:3000/api/voicings \
  -H "Content-Type: application/json" \
  -d '{"notes":[35,39,47]}' | jq*/

// ---------- helpers ----------
function uniqSorted(nums) {
  return [...new Set(nums)].sort((a, b) => a - b);
}

function pcsFromNotes(notes) {
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
  const span = notes[notes.length - 1] - notes[0];

  const pcs = notes.map(n => ((n % 12) + 12) % 12);
  const counts = new Map();
  for (const pc of pcs) counts.set(pc, (counts.get(pc) || 0) + 1);

  let doublingPenalty = 0;
  for (const c of counts.values()) doublingPenalty += Math.max(0, c - 1);

  return span * 10 + doublingPenalty * 3;
}
// -----------------------------

function sanitizeNotes(inputNotes) {
  return uniqSorted(
    inputNotes
      .map(Number)
      .filter(n => Number.isFinite(n))
  );
}

function normalizeOptions(input) {
  const rangeLow = Number.isFinite(input.rangeLow) ? input.rangeLow : 21;
  const rangeHigh = Number.isFinite(input.rangeHigh) ? input.rangeHigh : 108;
  const minNotes = Number.isFinite(input.minNotes) ? input.minNotes : 3;
  const maxNotes = Number.isFinite(input.maxNotes) ? input.maxNotes : 12;
  const maxSpan = Number.isFinite(input.maxSpan) ? input.maxSpan : 88;
  const limit = Number.isFinite(input.limit) ? Math.min(input.limit, 1000) : 200;

  return { rangeLow, rangeHigh, minNotes, maxNotes, maxSpan, limit };
}

function generateVoicings(input) {
  // input validation specific to generation
  if (!input || !Array.isArray(input.notes) || input.notes.length === 0) {
    return { error: "Body must include { notes: number[] }" };
  }

  const notes = sanitizeNotes(input.notes);
  if (notes.length === 0) {
    return { error: "No valid numeric notes provided." };
  }

  const pcsNeed = pcsFromNotes(notes);
  const { rangeLow, rangeHigh, minNotes, maxNotes, maxSpan, limit } = normalizeOptions(input);

  if (rangeHigh < rangeLow) {
    return { error: "rangeHigh must be >= rangeLow" };
  }
  if (minNotes < 1 || maxNotes < minNotes) {
    return { error: "Invalid minNotes/maxNotes" };
  }

  // build candidate notes
  const candidates = [];
  for (let n = rangeLow; n <= rangeHigh; n++) {
    const pc = ((n % 12) + 12) % 12;
    if (pcsNeed.includes(pc)) candidates.push(n);
  }

  const results = [];
  const COMBO_CAP = 300000;
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

  return {
    input: { notes, pcsNeed, rangeLow, rangeHigh, minNotes, maxNotes, maxSpan, limit },
    totalFound: results.length,
    voicings: results.slice(0, limit),
    truncatedBecauseComboCap: generated > COMBO_CAP,
  };
}

module.exports = {
  generateVoicings,
};