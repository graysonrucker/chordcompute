// server/lib/voicings.js

// ---------- helpers ----------
function uniqSorted(nums) {
  return [...new Set(nums)].sort((a, b) => a - b);
}

function mod12(n) {
  return ((n % 12) + 12) % 12;
}

function pcsFromNotes(notes) {
  return uniqSorted(notes.map(mod12));
}

function containsAllPitchClasses(voicingNotes, pcsNeed) {
  const have = new Set(voicingNotes.map(mod12));
  for (const pc of pcsNeed) if (!have.has(pc)) return false;
  return true;
}

function scoreVoicing(notes) {
  const span = notes[notes.length - 1] - notes[0];

  // simple doubling penalty (more doubles = slightly worse)
  const counts = new Map();
  for (const n of notes) {
    const pc = mod12(n);
    counts.set(pc, (counts.get(pc) || 0) + 1);
  }

  let doublingPenalty = 0;
  for (const c of counts.values()) doublingPenalty += Math.max(0, c - 1);

  return span * 10 + doublingPenalty * 3;
}

function sanitizeNotes(inputNotes) {
  return uniqSorted(
    inputNotes
      .map(Number)
      .filter((n) => Number.isFinite(n))
  );
}

function normalizeOptions(input) {
  const rangeLow = Number.isFinite(input.rangeLow) ? input.rangeLow : 21;
  const rangeHigh = Number.isFinite(input.rangeHigh) ? input.rangeHigh : 108;

  const minNotes = Number.isFinite(input.minNotes) ? input.minNotes : 3;
  const maxNotes = Number.isFinite(input.maxNotes) ? input.maxNotes : 12;

  const maxSpan = Number.isFinite(input.maxSpan) ? input.maxSpan : 88;

  // max number of returned results
  const limit = Number.isFinite(input.limit) ? Math.min(input.limit, 1000) : 200;

  // cap on *enumerated* combinations (prevents runaway)
  const comboCap = Number.isFinite(input.comboCap) ? Math.max(1, input.comboCap) : 300000;

  return { rangeLow, rangeHigh, minNotes, maxNotes, maxSpan, limit, comboCap };
}

// ---------- combination generator (no huge arrays) ----------
// yields combinations of indices into `arr` of size k
function* combinationsOf(arr, k, start = 0, combo = []) {
  if (combo.length === k) {
    yield combo.slice();
    return;
  }
  const n = arr.length;
  for (let i = start; i <= n - (k - combo.length); i++) {
    combo.push(arr[i]);
    yield* combinationsOf(arr, k, i + 1, combo);
    combo.pop();
  }
}

// ---------- generation ----------
function generateVoicings(input) {
  // input validation
  if (!input || !Array.isArray(input.notes) || input.notes.length === 0) {
    return { error: "Body must include { notes: number[] }" };
  }

  const notes = sanitizeNotes(input.notes);
  if (notes.length === 0) {
    return { error: "No valid numeric notes provided." };
  }

  const pcsNeed = pcsFromNotes(notes);
  const {
    rangeLow,
    rangeHigh,
    minNotes,
    maxNotes,
    maxSpan,
    limit,
    comboCap,
  } = normalizeOptions(input);

  if (rangeHigh < rangeLow) {
    return { error: "rangeHigh must be >= rangeLow" };
  }
  if (minNotes < 1 || maxNotes < minNotes) {
    return { error: "Invalid minNotes/maxNotes" };
  }

  // If you require N unique pitch classes, you cannot succeed with fewer than N notes.
  const minK = Math.max(minNotes, pcsNeed.length);

  if (minK > maxNotes) {
    return {
      input: { notes, pcsNeed, rangeLow, rangeHigh, minNotes, maxNotes, maxSpan, limit, comboCap },
      totalFound: 0,
      voicings: [],
      truncatedBecauseComboCap: false,
      note: `Impossible: need at least ${pcsNeed.length} notes to cover required pitch classes, but maxNotes=${maxNotes}.`,
    };
  }

  // Build candidate notes: only notes whose pitch class is in pcsNeed
  const pcsNeedSet = new Set(pcsNeed);
  const candidates = [];
  for (let n = rangeLow; n <= rangeHigh; n++) {
    if (pcsNeedSet.has(mod12(n))) candidates.push(n);
  }

  // If you have too few candidates to even pick k notes, no results.
  if (candidates.length < minK) {
    return {
      input: { notes, pcsNeed, rangeLow, rangeHigh, minNotes, maxNotes, maxSpan, limit, comboCap },
      totalFound: 0,
      voicings: [],
      truncatedBecauseComboCap: false,
      note: `Not enough candidates in range to pick ${minK} notes.`,
    };
  }

  const results = [];
  let enumerated = 0;
  let truncated = false;

  // Main loop
  for (let k = minK; k <= maxNotes; k++) {
    // If you request k notes but candidates are fewer, skip
    if (candidates.length < k) break;

    for (const v of combinationsOf(candidates, k)) {
      enumerated++;
      if (enumerated > comboCap) {
        truncated = true;
        break;
      }

      // quick span prune (v is sorted because candidates are sorted and we pick increasing indices)
      const span = v[v.length - 1] - v[0];
      if (span > maxSpan) continue;

      // must contain all required pitch classes
      if (!containsAllPitchClasses(v, pcsNeed)) continue;

      results.push({
        notes: v,
        span,
        score: scoreVoicing(v),
      });
    }

    if (truncated) break;
  }

  results.sort((a, b) => a.score - b.score);

  return {
    input: {
      notes,
      pcsNeed,
      rangeLow,
      rangeHigh,
      minNotes,
      maxNotes,
      maxSpan,
      limit,
      comboCap,
      effectiveMinNotes: minK, // helpful for debugging why k started where it did
    },
    totalFound: results.length,
    voicings: results.slice(0, limit),
    truncatedBecauseComboCap: truncated,
    enumeratedCombos: enumerated, // helpful for debugging
  };
}

module.exports = {
  generateVoicings,
};