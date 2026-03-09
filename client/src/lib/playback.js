/* ────────────────────────────────────────────────────────
   Chord / note playback via Tone.js

   Supports multiple instruments:
     - "synth"  → built-in PolySynth (instant, no downloads)
     - "piano"  → Salamander Grand Piano samples

   Lazily initializes on first play. The piano sampler
   loads asynchronously; if not ready, falls back to synth.
   ──────────────────────────────────────────────────────── */

let Tone = null;
let toneReady = false;
let toneLoading = false;

/* Instrument registry */
const instruments = {};
let activeInstrument = "synth";
let onLoadCallbacks = [];

const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

function midiToNoteName(midi) {
  const pc = ((midi % 12) + 12) % 12;
  const oct = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[pc]}${oct}`;
}

/* ── Tone.js bootstrap ─────────────────────────────────── */

async function ensureTone() {
  if (toneReady) return true;
  if (toneLoading) {
    return new Promise((resolve) => {
      onLoadCallbacks.push(resolve);
    });
  }
  toneLoading = true;
  try {
    Tone = await import("tone");
    await Tone.start();
    toneReady = true;
    onLoadCallbacks.forEach((cb) => cb(true));
    onLoadCallbacks = [];
    return true;
  } catch (err) {
    console.error("Tone.js init failed:", err);
    toneLoading = false;
    onLoadCallbacks.forEach((cb) => cb(false));
    onLoadCallbacks = [];
    return false;
  }
}

/* ── Synth instrument ──────────────────────────────────── */

function getSynth() {
  if (instruments.synth) return instruments.synth;
  instruments.synth = new Tone.PolySynth(Tone.Synth, {
    maxPolyphony: 24,
    voice: Tone.Synth,
    options: {
      oscillator: { type: "triangle4" },
      envelope: {
        attack: 0.01,
        decay: 0.4,
        sustain: 0.3,
        release: 1.2,
      },
      volume: -8,
    },
  }).toDestination();
  return instruments.synth;
}

/* ── Piano sampler ─────────────────────────────────────── */

const PIANO_BASE_URL = "https://tonejs.github.io/audio/salamander/";

/* We only sample every 3rd note for faster loading — Tone.Sampler
   interpolates the rest. This covers the full 88-key range.       */
const PIANO_SAMPLES = {
  A0: "A0.mp3", C1: "C1.mp3", "D#1": "Ds1.mp3",
  "F#1": "Fs1.mp3", A1: "A1.mp3", C2: "C2.mp3",
  "D#2": "Ds2.mp3", "F#2": "Fs2.mp3", A2: "A2.mp3",
  C3: "C3.mp3", "D#3": "Ds3.mp3", "F#3": "Fs3.mp3",
  A3: "A3.mp3", C4: "C4.mp3", "D#4": "Ds4.mp3",
  "F#4": "Fs4.mp3", A4: "A4.mp3", C5: "C5.mp3",
  "D#5": "Ds5.mp3", "F#5": "Fs5.mp3", A5: "A5.mp3",
  C6: "C6.mp3", "D#6": "Ds6.mp3", "F#6": "Fs6.mp3",
  A6: "A6.mp3", C7: "C7.mp3", "D#7": "Ds7.mp3",
  "F#7": "Fs7.mp3", A7: "A7.mp3", C8: "C8.mp3",
};

let pianoLoading = false;
let pianoReady = false;
let pianoCallbacks = [];

function loadPiano() {
  if (pianoReady) return Promise.resolve(true);
  if (pianoLoading) {
    return new Promise((resolve) => pianoCallbacks.push(resolve));
  }
  pianoLoading = true;

  return new Promise((resolve) => {
    instruments.piano = new Tone.Sampler({
      urls: PIANO_SAMPLES,
      baseUrl: PIANO_BASE_URL,
      release: 1.5,
      onload: () => {
        pianoReady = true;
        pianoCallbacks.forEach((cb) => cb(true));
        pianoCallbacks = [];
        resolve(true);
      },
      onerror: (err) => {
        console.error("Piano samples failed to load:", err);
        pianoLoading = false;
        pianoCallbacks.forEach((cb) => cb(false));
        pianoCallbacks = [];
        resolve(false);
      },
    }).toDestination();
  });
}

/* ── Instrument management ─────────────────────────────── */

async function getInstrument() {
  if (activeInstrument === "piano") {
    if (pianoReady && instruments.piano) return instruments.piano;
    // Start loading in background, fall back to synth for now
    loadPiano();
    return getSynth();
  }
  return getSynth();
}

/**
 * Switch the active instrument.
 * @param {"synth"|"piano"} name
 */
export async function setInstrument(name) {
  activeInstrument = name;
  if (name === "piano") {
    const ok = await ensureTone();
    if (ok) loadPiano(); // preload
  }
}

/**
 * @returns {"synth"|"piano"}
 */
export function getActiveInstrument() {
  return activeInstrument;
}

/**
 * @returns {boolean}
 */
export function isPianoLoaded() {
  return pianoReady;
}

/* ── Playback functions ────────────────────────────────── */

/**
 * Play a set of MIDI notes as a chord.
 */
export async function playChord(midiNotes, durationSec = 1.5) {
  if (!midiNotes || midiNotes.length === 0) return;
  const ok = await ensureTone();
  if (!ok) return;

  const inst = await getInstrument();
  const noteNames = midiNotes.map(midiToNoteName);
  const now = Tone.now();
  inst.triggerAttackRelease(noteNames, durationSec, now);
}

/**
 * Play notes as an arpeggio (bottom to top), then sustain the full chord.
 */
export async function playArpeggio(midiNotes, staggerSec = 0.08, holdSec = 1.2) {
  if (!midiNotes || midiNotes.length === 0) return;
  const ok = await ensureTone();
  if (!ok) return;

  const inst = await getInstrument();
  const sorted = [...midiNotes].sort((a, b) => a - b);
  const noteNames = sorted.map(midiToNoteName);
  const now = Tone.now();
  const totalStagger = staggerSec * (noteNames.length - 1);

  noteNames.forEach((note, i) => {
    const onset = now + i * staggerSec;
    const dur = totalStagger - i * staggerSec + holdSec;
    inst.triggerAttackRelease(note, dur, onset);
  });
}