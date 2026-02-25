// server/lib/voicings.js
// - Input: { notes: number[] }
// - Output: {
//     inputPattern: string,
//     totalFound: number,
//     voicings: { notes:number[], span:number, pattern:string, distance:number }[]
//   }
//
// Rules:
// 1) Generate candidates by independently shifting each input note by +/- 12*n octaves,
//    BUT only within the 88-key piano range (MIDI 21..108) using per-note shift bounds.
// 2) Reject candidates that contain duplicate MIDI notes.
// 3) Rank by span (tightest first), then closeness to input chord (distance),
//    then bass proximity, then lexicographic.
// 4) Keep only the best candidate for each interval pattern (adjacent diffs).
//
// Notes:
// - totalFound = total unique interval patterns found (NOT limited by LIMIT)
// - voicings = first LIMIT best candidates across patterns
// - To reduce memory, don't store "pattern" on the candidate object; add it at the end.
// - seenExact helps avoid exact duplicates but can grow large for big caps.

function sorted(nums) {
  return nums.slice().sort((a, b) => a - b);
}

function sanitizeNotes(inputNotes) {
  return sorted(inputNotes.map(Number).filter((n) => Number.isFinite(n)));
}

function intervalPatternKey(sortedNotes) {
  if (sortedNotes.length <= 1) return "";
  const diffs = [];
  for (let i = 0; i < sortedNotes.length - 1; i++) {
    diffs.push(sortedNotes[i + 1] - sortedNotes[i]);
  }
  return diffs.join(",");
}

function spanOf(sortedNotes) {
  return sortedNotes[sortedNotes.length - 1] - sortedNotes[0];
}

function distanceToInput(sortedVoicing, sortedInput) {
  let sum = 0;
  for (let i = 0; i < sortedInput.length; i++) {
    sum += Math.abs(sortedVoicing[i] - sortedInput[i]);
  }
  return sum;
}

function hasDuplicateMidi(sortedNotes) {
  // Because sorted, duplicates are adjacent
  for (let i = 1; i < sortedNotes.length; i++) {
    if (sortedNotes[i] === sortedNotes[i - 1]) return true;
  }
  return false;
}

// Internal safety limits
const LIMIT = 10000;
const HARD_ENUM_CAP = 5_000_000;

// 88-key piano MIDI range
const PIANO_LOW = 21;   // A0
const PIANO_HIGH = 108; // C8

function floorDiv(a, b) {
  // b > 0
  return Math.floor(a / b);
}

function ceilDiv(a, b) {
  // b > 0
  return Math.ceil(a / b);
}

function computeShiftRanges(chord) {
  // For each note n: shifts s such that PIANO_LOW <= n + 12*s <= PIANO_HIGH
  // => ceil((PIANO_LOW - n)/12) <= s <= floor((PIANO_HIGH - n)/12)
  return chord.map((n) => {
    const minShift = ceilDiv(PIANO_LOW - n, 12);
    const maxShift = floorDiv(PIANO_HIGH - n, 12);
    return [minShift, maxShift];
  });
}

function* shiftVectorsFromRanges(ranges, idx = 0, cur = []) {
  if (idx === ranges.length) {
    yield cur.slice();
    return;
  }
  const [lo, hi] = ranges[idx];
  for (let s = lo; s <= hi; s++) {
    cur.push(s);
    yield* shiftVectorsFromRanges(ranges, idx + 1, cur);
    cur.pop();
  }
}

function compareCandidates(a, b, chord) {
  //sort: span, distance, bass proximity, then lexicographic
  if (a.span !== b.span) return a.span - b.span;
  if (a.distance !== b.distance) return a.distance - b.distance;

  const ab = Math.abs(a.notes[0] - chord[0]);
  const bb = Math.abs(b.notes[0] - chord[0]);
  if (ab !== bb) return ab - bb;

  for (let i = 0; i < a.notes.length; i++) {
    if (a.notes[i] !== b.notes[i]) return a.notes[i] - b.notes[i];
  }
  return 0;
}

function generateVoicings(input) {
  if (!input || !Array.isArray(input.notes) || input.notes.length === 0) {
    return { error: "Body must include { notes: number[] }" };
  }

  const chord = sanitizeNotes(input.notes);
  if (chord.length === 0) {
    return { error: "No valid numeric notes provided." };
  }

  const inputPattern = intervalPatternKey(chord);

  const ranges = computeShiftRanges(chord);

  const seenExact = new Set();      // exact MIDI voicing dedupe
  const bestByPattern = new Map();  // pattern -> best candidate
  let enumerated = 0;

  for (const shifts of shiftVectorsFromRanges(ranges)) {
    enumerated++;
    if (enumerated > HARD_ENUM_CAP) break;

    const v = chord.map((n, i) => n + 12 * shifts[i]).sort((a, b) => a - b);

    // Individual notes are guaranteed in-range by construction.
    if (hasDuplicateMidi(v)) continue;

    const exactKey = v.join(",");
    if (seenExact.has(exactKey)) continue;
    seenExact.add(exactKey);

    const pattern = intervalPatternKey(v);

    const cand = {
      notes: v,
      span: spanOf(v),
      distance: distanceToInput(v, chord),
    };

    const prev = bestByPattern.get(pattern);
    if (!prev || compareCandidates(cand, prev, chord) < 0) {
      bestByPattern.set(pattern, cand);
    }
  }

  // Materialize + sort winners
  const all = [];
  for (const [pattern, cand] of bestByPattern.entries()) {
    all.push({ ...cand, pattern });
  }
  all.sort((a, b) => compareCandidates(a, b, chord));

  return {
    inputPattern,
    totalFound: all.length, // unique patterns found (NOT limited)
    voicings: all.slice(0, LIMIT),
  };
}

module.exports = { generateVoicings };