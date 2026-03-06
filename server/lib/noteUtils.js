const NOTE_NAMES = ["C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B"];

function midiToName(m) {
  const pc = ((m % 12) + 12) % 12;
  const octave = Math.floor(m / 12) - 1;
  return `${NOTE_NAMES[pc]}${octave}`;
}

function midiArrayToNames(arr) {
  return arr.map(midiToName);
}

// Number of MIDI keys on an 88-key piano (21..108) per pitch class.
// pc 0 = C: keys 24,36,48,60,72,84,96 => 7 keys... let's compute exactly.
const KEYS_PER_PC = (() => {
  const counts = new Array(12).fill(0);
  for (let midi = 21; midi <= 108; midi++) {
    counts[((midi % 12) + 12) % 12]++;
  }
  return counts; // [8, 8, 8, 8, 8, 8, 8, 7, 8, 8, 8, 8] roughly
})();

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
 * Estimates the number of voicings the generator will *visit* (not necessarily keep)
 * for the given MIDI input notes.
 *
 * Formula: product over each pitch class i of C(keysPerPc[i], multiplicity[i])
 *
 * This counts the ways to assign each required pitch class to distinct piano keys,
 * ignoring ordering and deduplication — so it's an upper bound on unique voicings found.
 *
 * Returns a number (may be very large — use BigInt variant if needed for display).
 */
function estimateVoicings(midiNotes) {
  // Count multiplicity of each pitch class in the input
  const mult = new Array(12).fill(0);
  for (const m of midiNotes) {
    mult[((m % 12) + 12) % 12]++;
  }

  let estimate = 1;
  for (let pc = 0; pc < 12; pc++) {
    if (mult[pc] === 0) continue;
    const ways = binomial(KEYS_PER_PC[pc], mult[pc]);
    if (ways === 0) return 0; // impossible chord (more notes than keys for that pc)
    estimate *= ways;
  }

  return estimate;
}

// Threshold above which the span-loop generation strategy is used instead of
// the single-pass strategy (which OOMs at ~50M due to FlatHashSet growth).
const SPAN_MODE_THRESHOLD = 50_000_000;

/**
 * Returns "span" or "fast" based on the voicing estimate.
 */
function generationMode(midiNotes) {
  const estimate = estimateVoicings(midiNotes);
  return estimate >= SPAN_MODE_THRESHOLD ? "span" : "fast";
}

module.exports = {
  midiToName,
  midiArrayToNames,
  estimateVoicings,
  generationMode,
  SPAN_MODE_THRESHOLD,
  KEYS_PER_PC,
};