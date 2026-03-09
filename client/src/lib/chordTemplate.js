/* ────────────────────────────────────────────────────────
   Build MIDI notes from a chord template selection.
   Returns notes in canonical tertian stacking (each voice
   placed above the previous one).
   ──────────────────────────────────────────────────────── */

const QUALITIES = {
  major: { third: 4, fifth: 7 },
  minor: { third: 3, fifth: 7 },
  dim:   { third: 3, fifth: 6 },
  aug:   { third: 4, fifth: 8 },
  sus2:  { third: 2, fifth: 7 },
  sus4:  { third: 5, fifth: 7 },
};

const SEVENTH_INTERVALS = {
  none: null,
  maj7: 11,
  dom7: 10,
  dim7: 9,
};

/**
 * @param {number}   rootPc       – pitch class 0-11 (C=0)
 * @param {string}   quality      – major | minor | dim | aug | sus2 | sus4
 * @param {string}   seventh      – none | maj7 | dom7 | dim7
 * @param {string[]} extensions   – subset of ["9","11","13"]
 * @param {string[]} alterations  – subset of ["b5","#5","b9","#9","#11","b13"]
 * @param {string[]} omissions    – subset of ["no3","no5"]
 * @returns {number[]} sorted MIDI note array in tertian stacking
 */
export function buildChordMidi(
  rootPc,
  quality,
  seventh = "none",
  extensions = [],
  alterations = [],
  omissions = [],
) {
  const q = QUALITIES[quality];
  if (!q) return [];

  /* Collect intervals as a name→semitones map so alterations
     can override specific voices cleanly.                      */
  const iv = new Map();
  iv.set("root", 0);
  iv.set("third", q.third);
  iv.set("fifth", q.fifth);

  const sev = SEVENTH_INTERVALS[seventh];
  if (sev != null) iv.set("seventh", sev);

  if (extensions.includes("9"))  iv.set("ninth", 2);
  if (extensions.includes("11")) iv.set("eleventh", 5);
  if (extensions.includes("13")) iv.set("thirteenth", 9);

  /* Alterations override the interval value */
  if (alterations.includes("b5"))  iv.set("fifth", 6);
  if (alterations.includes("#5"))  iv.set("fifth", 8);
  if (alterations.includes("b9"))  iv.set("ninth", 1);
  if (alterations.includes("#9"))  iv.set("ninth", 3);
  if (alterations.includes("#11")) iv.set("eleventh", 6);
  if (alterations.includes("b13")) iv.set("thirteenth", 8);

  /* Omissions remove a voice entirely */
  if (omissions.includes("no3")) iv.delete("third");
  if (omissions.includes("no5")) iv.delete("fifth");
  if (omissions.includes("no9")) iv.delete("ninth");
  if (omissions.includes("no11")) iv.delete("eleventh");

  /* Tertian stacking order — each note is placed in the lowest
     octave that keeps it above the previous note.               */
  const ORDER = [
    "root", "third", "fifth", "seventh",
    "ninth", "eleventh", "thirteenth",
  ];

  const baseMidi = 48 + rootPc; // root in octave 3 (base range start)
  const notes = [];
  let lastMidi = -Infinity;

  for (const name of ORDER) {
    if (!iv.has(name)) continue;
    const semis = iv.get(name);
    let midi = baseMidi + semis;
    while (midi <= lastMidi) midi += 12;
    notes.push(midi);
    lastMidi = midi;
  }

  return notes;
}

/* Note names for UI display */
export const SHARP_NAMES = ["C","C♯","D","D♯","E","F","F♯","G","G♯","A","A♯","B"];
export const FLAT_NAMES  = ["C","D♭","D","E♭","E","F","G♭","G","A♭","A","B♭","B"];

/* ── Build a display name directly from template params ── */

const QUAL_SYM = { major:"", minor:"m", dim:"dim", aug:"aug", sus2:"sus2", sus4:"sus4" };
const ALT_SYM  = { b5:"♭5", "#5":"♯5", b9:"♭9", "#9":"♯9", "#11":"♯11", b13:"♭13" };

/**
 * Generates the canonical chord symbol from template selections.
 * This is authoritative — it's what the user asked for, regardless
 * of what the heuristic detector might call the same set of notes.
 */
export function buildChordName(rootPc, quality, seventh, extensions, alterations, omissions, names) {
  const root = names[rootPc];
  const qSym = QUAL_SYM[quality] ?? "";

  const extSet = new Set(extensions);
  const isMajSev = seventh === "maj7";
  const isDimSev = seventh === "dim7";
  const isMinor  = quality === "minor";

  /* Determine highest stacked extension.
     Even without 9, 11th/13th name the chord (with "no9" annotation). */
  let baseSym = "";
  const parens = [];

  if (seventh === "none") {
    baseSym = "";
    if (extSet.has("9"))  parens.push("add9");
    if (extSet.has("11")) parens.push("add11");
    if (extSet.has("13")) parens.push("add13");
  } else {
    const has9 = extSet.has("9"), has11 = extSet.has("11"), has13 = extSet.has("13");
    let sevPrefix = isMajSev ? "maj" : (isDimSev ? "dim" : "");
    if (isMinor && isMajSev) sevPrefix = "mMaj";

    if (has13) {
      baseSym = sevPrefix + "13";
      if (has11) parens.push("11");
      if (!has9) parens.push("no9");
    } else if (has11) {
      baseSym = sevPrefix + "11";
      if (!has9) parens.push("no9");
    } else if (has9) {
      baseSym = sevPrefix + "9";
    } else {
      baseSym = sevPrefix + "7";
    }

    /* For dim quality + dim seventh, avoid "dimdim7" → just "dim7" */
    if (quality === "dim" && isDimSev) {
      baseSym = baseSym.replace(/^dim/, "");
    }
  }

  /* Alterations */
  for (const a of alterations) {
    parens.push(ALT_SYM[a] ?? a);
  }

  /* Omissions */
  for (const o of omissions) {
    parens.push(o);
  }

  const useQSym = (isMinor && isMajSev) ? "" : qSym;
  const suffix = parens.length > 0 ? `(${parens.join(",")})` : "";
  return `${root}${useQSym}${baseSym}${suffix}`;
}