// client/src/lib/voicingEstimate.js
//
// Mirrors the voicing estimation logic from server/lib/noteUtils.js so the
// client can predict generation mode and warn the user — without a round-trip.
//
// Critically, estimation must account for the user's selected piano range
// (rangeLow..rangeHigh), matching how VoicingGenerator::buildMidiTable() only
// populates midiTable[pc] with keys inside that range.

/**
 * Computes available keys per pitch class for a given MIDI range.
 * Mirrors VoicingGenerator::buildMidiTable in the C++ engine.
 * @param {number} rangeLow   lowest MIDI note (inclusive)
 * @param {number} rangeHigh  highest MIDI note (inclusive)
 * @returns {number[]} 12-element array, counts[pc] = keys available in range
 */
function keysPerPcForRange(rangeLow, rangeHigh) {
  const counts = new Array(12).fill(0);
  for (let midi = rangeLow; midi <= rangeHigh; midi++) {
    counts[((midi % 12) + 12) % 12]++;
  }
  return counts;
}

function binomial(n, k) {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  k = Math.min(k, n - k);
  let result = 1;
  for (let i = 0; i < k; i++) result = (result * (n - i)) / (i + 1);
  return Math.round(result);
}

/**
 * Estimates the number of voicings for the given MIDI notes within a range.
 * @param {number[]} midiNotes  selected notes
 * @param {number}   rangeLow   piano range low (default: full 88-key, MIDI 21)
 * @param {number}   rangeHigh  piano range high (default: full 88-key, MIDI 108)
 * @returns {number}
 */
export function estimateVoicings(midiNotes, rangeLow = 21, rangeHigh = 108) {
  const keysPerPc = keysPerPcForRange(rangeLow, rangeHigh);
  const mult = new Array(12).fill(0);
  for (const m of midiNotes) mult[((m % 12) + 12) % 12]++;
  let estimate = 1;
  for (let pc = 0; pc < 12; pc++) {
    if (mult[pc] === 0) continue;
    const ways = binomial(keysPerPc[pc], mult[pc]);
    if (ways === 0) return 0;
    estimate *= ways;
  }
  return estimate;
}

/** Threshold above which span-mode generation is used (matches server). */
export const SPAN_MODE_THRESHOLD = 50_000_000;

/**
 * Returns true if the note set will trigger span-mode (large) generation.
 * @param {number[]} midiNotes
 * @param {number}   rangeLow
 * @param {number}   rangeHigh
 */
export function isLargeJob(midiNotes, rangeLow = 21, rangeHigh = 108) {
  return estimateVoicings(midiNotes, rangeLow, rangeHigh) >= SPAN_MODE_THRESHOLD;
}

/**
 * Formats a voicing count for display.
 * e.g. 1_500_000 → "1.5M",  2_300_000_000 → "2.3B"
 */
export function formatEstimate(n) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(0)}M`;
  return n.toLocaleString();
}