// - Input: { notes: number[] }
// - Output: { inputPattern: string, voicings: { notes:number[], span:number, pattern:string, distance:number }[] }

// 1) Generate candidates by independently shifting each input note by +/- 12*n octaves.
// 2) Discard candidates outside 88-key piano range (MIDI 21..108).
// 3) Reject candidates that contain duplicate MIDI notes.
// 4) Sort primarily by span (tightest first), then by closeness to input chord.
// 5) Keep only the first candidate for each interval pattern (adjacent diffs).

/*Currently, voicings with same notes and span that only differ by octave
  are considered equivalent and are not returned
  i.e. {C4,E4,G4} and {C5,E5,G5}*/

function sorted(nums) {
  return nums.slice().sort((a, b) => a - b);
}

function sanitizeNotes(inputNotes) {
  return sorted(
    inputNotes
      .map(Number)
      .filter((n) => Number.isFinite(n))
  );
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
  // Both arrays are sorted, same length.
  let sum = 0;
  for (let i = 0; i < sortedInput.length; i++) {
    sum += Math.abs(sortedVoicing[i] - sortedInput[i]);
  }
  return sum;
}

function* octaveShiftVectors(k, d, idx = 0, cur = []) {
  if (idx === k) {
    yield cur.slice();
    return;
  }
  for (let x = -d; x <= d; x++) {
    cur.push(x);
    yield* octaveShiftVectors(k, d, idx + 1, cur);
    cur.pop();
  }
}

function allNotesInRange(sortedNotes, low, high) {
  return sortedNotes[0] >= low && sortedNotes[sortedNotes.length - 1] <= high;
}

function hasDuplicateMidi(sortedNotes) {
  // Because sorted, duplicates are adjacent
  for (let i = 1; i < sortedNotes.length; i++) {
    if (sortedNotes[i] === sortedNotes[i - 1]) return true;
  }
  return false;
}

// Internal safety limits
const LIMIT = 1000;
const MAX_D = 6;
const HARD_ENUM_CAP = 500000;

// 88-key piano MIDI range
const PIANO_LOW = 21;   // A0
const PIANO_HIGH = 108; // C8

function generateVoicings(input) {
  if (!input || !Array.isArray(input.notes) || input.notes.length === 0) {
    return { error: "Body must include { notes: number[] }" };
  }

  const chord = sanitizeNotes(input.notes);
  if (chord.length === 0) {
    return { error: "No valid numeric notes provided." };
  }

  const k = chord.length;
  const inputPattern = intervalPatternKey(chord);

  const candidates = [];
  const seenExact = new Set();
  let enumerated = 0;

  for (let d = 0; d <= MAX_D; d++) {
    for (const shifts of octaveShiftVectors(k, d)) {
      enumerated++;
      if (enumerated > HARD_ENUM_CAP) break;

      const v = chord.map((n, i) => n + 12 * shifts[i]).sort((a, b) => a - b);

      if (!allNotesInRange(v, PIANO_LOW, PIANO_HIGH)) continue;

      //reject same MIDI appearing twice in a voicing (e.g., [60,60])
      if (hasDuplicateMidi(v)) continue;

      const exactKey = v.join(",");
      if (seenExact.has(exactKey)) continue;
      seenExact.add(exactKey);

      candidates.push({
        notes: v,
        span: spanOf(v),
        pattern: intervalPatternKey(v),
        distance: distanceToInput(v, chord),
      });
    }
    if (enumerated > HARD_ENUM_CAP) break;
  }

  candidates.sort((a, b) => {
    if (a.span !== b.span) return a.span - b.span;
    if (a.distance !== b.distance) return a.distance - b.distance;

    const ab = Math.abs(a.notes[0] - chord[0]);
    const bb = Math.abs(b.notes[0] - chord[0]);
    if (ab !== bb) return ab - bb;

    for (let i = 0; i < a.notes.length; i++) {
      if (a.notes[i] !== b.notes[i]) return a.notes[i] - b.notes[i];
    }
    return 0;
  });

  const seenPatterns = new Set();
  const out = [];

  for (const c of candidates) {
    if (seenPatterns.has(c.pattern)) continue;
    seenPatterns.add(c.pattern);
    out.push(c);
    if (out.length >= LIMIT) break;
  }

  return {
    inputPattern,
    voicings: out,
  };
}

module.exports = { generateVoicings };