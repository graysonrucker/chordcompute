const NOTE_NAMES = ["C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B"];

function midiToName(m) {
  const pc = ((m % 12) + 12) % 12;
  const octave = Math.floor(m / 12) - 1;
  return `${NOTE_NAMES[pc]}${octave}`;
}

function midiArrayToNames(arr) {
  return arr.map(midiToName);
}

// C(n, k) — exact integer for small n (max n=8, k<=4 in practice here)
function binomial(n, k) {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  // Use the smaller of k and n-k
  k = Math.min(k, n - k);
  let result = 1;
  for (let i = 0; i < k; i++) {
    result = result * (n - i) / (i + 1);
  }
  return Math.round(result);
}

/**
 * Computes available keys per pitch class for a given MIDI range.
 * Mirrors VoicingGenerator::buildMidiTable — only keys inside [rangeLow, rangeHigh]
 * are candidates, so the estimate must reflect the same constraint.
 */
function keysPerPcForRange(rangeLow, rangeHigh) {
  const counts = new Array(12).fill(0);
  for (let midi = rangeLow; midi <= rangeHigh; midi++) {
    counts[((midi % 12) + 12) % 12]++;
  }
  return counts;
}

/**
 * Estimates the number of voicings the generator will *visit* for the given
 * MIDI input notes, constrained to the user's selected piano range.
 *
 * Formula: product over each pitch class i of C(keysInRangePerPc[i], multiplicity[i])
 *
 * @param {number[]} midiNotes
 * @param {number}   rangeLow   (default 21 — full 88-key keyboard)
 * @param {number}   rangeHigh  (default 108)
 */
function estimateVoicings(midiNotes, rangeLow = 21, rangeHigh = 108) {
  const keysPerPc = keysPerPcForRange(rangeLow, rangeHigh);
  const mult = new Array(12).fill(0);
  for (const m of midiNotes) {
    mult[((m % 12) + 12) % 12]++;
  }

  let estimate = 1;
  for (let pc = 0; pc < 12; pc++) {
    if (mult[pc] === 0) continue;
    const ways = binomial(keysPerPc[pc], mult[pc]);
    if (ways === 0) return 0;
    estimate *= ways;
  }

  return estimate;
}

// Threshold above which the span-loop generation strategy is used instead of
// the single-pass strategy (which OOMs at ~50M due to FlatHashSet growth).
const SPAN_MODE_THRESHOLD = 50_000_000;

/**
 * Returns "span" or "fast" based on the voicing estimate for the given range.
 * @param {number[]} midiNotes
 * @param {number}   rangeLow
 * @param {number}   rangeHigh
 */
function generationMode(midiNotes, rangeLow = 21, rangeHigh = 108) {
  const estimate = estimateVoicings(midiNotes, rangeLow, rangeHigh);
  return estimate >= SPAN_MODE_THRESHOLD ? "span" : "fast";
}

module.exports = {
  midiToName,
  midiArrayToNames,
  estimateVoicings,
  generationMode,
  SPAN_MODE_THRESHOLD,
};