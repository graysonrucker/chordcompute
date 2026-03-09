/* ────────────────────────────────────────────────────────
   Heuristic chord detection from a set of MIDI notes.
   • 1 note  → note name with octave    (e.g. "C4")
   • 2 notes → interval name            (e.g. "minor 3rd: C → E♭")
   • 3+ notes → scored chord name       (e.g. "Cmaj7")
   ──────────────────────────────────────────────────────── */

const SHARP = ["C","C♯","D","D♯","E","F","F♯","G","G♯","A","A♯","B"];
const FLAT  = ["C","D♭","D","E♭","E","F","G♭","G","A♭","A","B♭","B"];

/* ── 1-note: note + octave ─────────────────────────────── */

function formatNote(midi, names) {
  const pc = ((midi % 12) + 12) % 12;
  const oct = Math.floor(midi / 12) - 1;
  return `${names[pc]}${oct}`;
}

/* ── 2-note: interval ──────────────────────────────────── */

const INTERVAL_LABELS = [
  "unison",       "minor 2nd",   "major 2nd",    "minor 3rd",
  "major 3rd",    "perfect 4th", "tritone",      "perfect 5th",
  "minor 6th",    "major 6th",   "minor 7th",    "major 7th",
];

function formatInterval(midiArr, names) {
  const sorted = [...midiArr].sort((a, b) => a - b);
  const semis = sorted[1] - sorted[0];
  const label = INTERVAL_LABELS[semis % 12] ?? `${semis % 12} semitones`;
  const lo = names[((sorted[0] % 12) + 12) % 12];
  const hi = names[((sorted[1] % 12) + 12) % 12];
  if (semis % 12 === 0 && semis > 0) return `octave: ${lo} → ${hi}`;
  return `${label}: ${lo} → ${hi}`;
}

/* ── 3+ notes: heuristic chord naming ──────────────────── */

/*  Each template defines:
    - iv:   intervals (semitones above root) that must ALL be present
    - opt:  intervals that are conventionally implied but may be absent
            (annotated "no9", "no11" etc. when missing)
    - sym:  the chord symbol
    - cost: base complexity score (lower = preferred)

    The 5th (interval 7) is universally optional across all templates
    and doesn't need to be listed in opt.

    Templates are ordered 13th → 11th → 9th → 7th → triads so that
    when two templates tie on score, the higher extension wins.        */

const TEMPLATES = [
  // ── 13th chords ──
  { iv: [4,7,10,2,9],  opt: [2],    sym: "13",       cost: 4 },
  { iv: [4,7,11,2,9],  opt: [2],    sym: "maj13",    cost: 4 },
  { iv: [3,7,10,2,9],  opt: [2],    sym: "m13",      cost: 4 },
  { iv: [3,7,11,2,9],  opt: [2],    sym: "mMaj13",   cost: 4 },
  // ── 11th chords ──
  { iv: [3,7,10,2,5],  opt: [2],    sym: "m11",      cost: 4 },
  { iv: [4,7,10,2,5],  opt: [2],    sym: "11",       cost: 4 },
  { iv: [4,7,11,2,5],  opt: [2],    sym: "maj11",    cost: 4 },
  { iv: [3,7,11,2,5],  opt: [2],    sym: "mMaj11",   cost: 4 },
  // ── 9th chords ──
  { iv: [4,7,10,2],    opt: [],     sym: "9",        cost: 3 },
  { iv: [4,7,11,2],    opt: [],     sym: "maj9",     cost: 3 },
  { iv: [3,7,10,2],    opt: [],     sym: "m9",       cost: 3 },
  { iv: [3,7,11,2],    opt: [],     sym: "mMaj9",    cost: 4 },
  // ── 7th chords ──
  { iv: [4,7,11],      opt: [],     sym: "maj7",     cost: 2 },
  { iv: [4,7,10],      opt: [],     sym: "7",        cost: 2 },
  { iv: [3,7,10],      opt: [],     sym: "m7",       cost: 2 },
  { iv: [3,7,11],      opt: [],     sym: "mMaj7",    cost: 3 },
  { iv: [3,6,10],      opt: [],     sym: "m7♭5",     cost: 2 },
  { iv: [3,6,9],       opt: [],     sym: "dim7",     cost: 2 },
  { iv: [4,8,11],      opt: [],     sym: "augMaj7",  cost: 4 },
  { iv: [4,8,10],      opt: [],     sym: "7♯5",      cost: 4 },
  // ── 6th chords ──
  { iv: [4,7,9],       opt: [],     sym: "6",        cost: 2 },
  { iv: [3,7,9],       opt: [],     sym: "m6",       cost: 2 },
  // ── Triads ──
  { iv: [4,7],         opt: [],     sym: "",         cost: 0 },
  { iv: [3,7],         opt: [],     sym: "m",        cost: 0 },
  { iv: [3,6],         opt: [],     sym: "dim",      cost: 1 },
  { iv: [4,8],         opt: [],     sym: "aug",      cost: 1 },
  { iv: [5,7],         opt: [],     sym: "sus4",     cost: 1 },
  { iv: [2,7],         opt: [],     sym: "sus2",     cost: 1 },
  // ── Dyad ──
  { iv: [7],           opt: [],     sym: "5",        cost: 0 },
  // ── Bare root fallback ──
  { iv: [],            opt: [],     sym: "",         cost: 8 },
];

/* Label for a missing optional interval */
const MISSING_LABELS = { 7: "no5", 2: "no9", 5: "no11" };

/* Attempt to match a template against a set of present intervals.
   Returns { score, missing, remaining } or null if not viable.

   An interval can be missing if it's:
     - 7 (the 5th, universally optional), OR
     - listed in the template's opt array                           */

function matchTemplate(tmpl, intervals) {
  const optSet = new Set([7, ...tmpl.opt]);
  const missing = tmpl.iv.filter((i) => !intervals.has(i));

  // Every missing interval must be optional
  if (missing.some((i) => !optSet.has(i))) return null;

  const tmplSet = new Set(tmpl.iv);
  const remaining = [...intervals].filter((i) => !tmplSet.has(i));
  const missingPenalty = missing.length * 1;
  const score = remaining.length * 3 + missingPenalty + tmpl.cost;

  return { score, missing, remaining };
}

/* Map a leftover interval to its extension label.                  */

function nameExtension(iv, tmplSet, has7th) {
  switch (iv) {
    case 1:  return "♭9";
    case 2:  return has7th ? "9"  : "add9";
    case 3:  return tmplSet.has(4) ? "♯9" : "♯9";
    case 4:  return "3";
    case 5:  return has7th ? "11" : "add11";
    case 6:  return tmplSet.has(7) ? "♯11" : "♭5";
    case 7:  return "5";
    case 8:  return tmplSet.has(7) ? "♭13" : "♯5";
    case 9:  return has7th ? "13" : "add13";
    case 10: return "7";
    case 11: return "maj7";
    default: return `(${iv})`;
  }
}

/* Preferred ordering for extension display: additions first, then "no" */
const EXT_ORDER = [10, 11, 1, 2, 3, 4, 5, 6, 7, 8, 9];

function detectChordName(pcs, names, forceRootPc) {
  const pcArr = [...new Set(pcs)].sort((a, b) => a - b);
  if (pcArr.length === 0) return null;

  const rootCandidates = forceRootPc != null ? [forceRootPc] : pcArr;
  let best = null;

  for (const root of rootCandidates) {
    const intervals = new Set();
    for (const pc of pcArr) intervals.add((pc - root + 12) % 12);
    intervals.delete(0);

    for (const tmpl of TEMPLATES) {
      const result = matchTemplate(tmpl, intervals);
      if (!result) continue;

      if (!best || result.score < best.score) {
        const tmplSet = new Set(tmpl.iv);
        const has7th = tmplSet.has(10) || tmplSet.has(11);

        const extensions = result.remaining
          .sort((a, b) => EXT_ORDER.indexOf(a) - EXT_ORDER.indexOf(b))
          .map((i) => nameExtension(i, tmplSet, has7th));

        const missingLabels = result.missing
          .map((i) => MISSING_LABELS[i] ?? `no${i}`)

        best = {
          root,
          sym: tmpl.sym,
          extensions,
          missingLabels,
          score: result.score,
        };
      }
    }
  }

  if (!best) return null;

  const rootName = names[best.root];
  const parts = [...best.extensions, ...best.missingLabels];
  const suffix = parts.length > 0 ? `(${parts.join(",")})` : "";
  return `${rootName}${best.sym}${suffix}`;
}

/* ── Public API ────────────────────────────────────────── */

export function detectChord(midiNotes, preferSharps, bottomAsRoot = false) {
  if (!midiNotes || midiNotes.length === 0) return null;

  const names = preferSharps ? SHARP : FLAT;

  // 1 note → name + octave
  if (midiNotes.length === 1) {
    return formatNote(midiNotes[0], names);
  }

  // 2 notes → interval
  if (midiNotes.length === 2) {
    return formatInterval(midiNotes, names);
  }

  // 3+ notes → chord name
  const pcs = [...new Set(midiNotes.map((m) => ((m % 12) + 12) % 12))];

  // All notes same pitch class → show as single note
  if (pcs.length === 1) {
    return formatNote(midiNotes[0], names);
  }
  // Only 2 distinct pitch classes → show interval
  if (pcs.length === 2) {
    const sorted = [...midiNotes].sort((a, b) => a - b);
    const first = sorted[0];
    const second = sorted.find(
      (m) => ((m % 12) + 12) % 12 !== ((first % 12) + 12) % 12
    );
    return formatInterval([first, second], names);
  }

  // When bottomAsRoot is on, force the lowest note's pitch class as root
  const forceRootPc = bottomAsRoot
    ? ((Math.min(...midiNotes) % 12) + 12) % 12
    : undefined;

  return detectChordName(pcs, names, forceRootPc);
}