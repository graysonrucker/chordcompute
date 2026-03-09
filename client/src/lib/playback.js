/* ────────────────────────────────────────────────────────
   Chord / note playback via Tone.js

   Supports multiple instruments:
     - "synth"  → built-in PolySynth (instant, no downloads)
     - "piano"  → Salamander Grand Piano samples

   The Tone import and sample loading happen eagerly (no
   user gesture needed). Only Tone.start() — which resumes
   the AudioContext — requires a gesture and is deferred
   to the first play call.
   ──────────────────────────────────────────────────────── */

let Tone = null;
let toneImported = false;
let toneImporting = false;
let contextStarted = false;

/* Instrument registry */
const instruments = {};
let activeInstrument = "synth";

const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

function midiToNoteName(midi) {
  const pc = ((midi % 12) + 12) % 12;
  const oct = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[pc]}${oct}`;
}

/* ── Listeners ─────────────────────────────────────────── */

const listeners = new Set();

export function onLoadChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notifyListeners() {
  for (const fn of listeners) fn();
}

/* ── Tone import (no gesture required) ─────────────────── */

let importPromise = null;

async function ensureToneImported() {
  if (toneImported) return true;
  if (importPromise) return importPromise;

  importPromise = (async () => {
    toneImporting = true;
    try {
      Tone = await import("tone");
      toneImported = true;
      return true;
    } catch (err) {
      console.error("Tone.js import failed:", err);
      toneImporting = false;
      return false;
    }
  })();
  return importPromise;
}

/* AudioContext resume — needs user gesture, called at play time */
async function ensureContextStarted() {
  if (contextStarted) return true;
  if (!toneImported || !Tone) return false;
  try {
    await Tone.start();
    contextStarted = true;
    return true;
  } catch (err) {
    console.error("Tone.start() failed:", err);
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
let pianoPromise = null;

function loadPiano() {
  if (pianoReady) return Promise.resolve(true);
  if (pianoPromise) return pianoPromise;

  pianoLoading = true;
  notifyListeners();

  pianoPromise = new Promise((resolve) => {
    instruments.piano = new Tone.Sampler({
      urls: PIANO_SAMPLES,
      baseUrl: PIANO_BASE_URL,
      release: 1.5,
      onload: () => {
        pianoReady = true;
        pianoLoading = false;
        notifyListeners();
        resolve(true);
      },
      onerror: (err) => {
        console.error("Piano samples failed to load:", err);
        pianoLoading = false;
        pianoPromise = null;
        notifyListeners();
        resolve(false);
      },
    }).toDestination();
  });
  return pianoPromise;
}

/* ── Instrument management ─────────────────────────────── */

async function getInstrument() {
  if (activeInstrument === "piano") {
    if (pianoReady && instruments.piano) return instruments.piano;
    loadPiano();
    return getSynth();
  }
  return getSynth();
}

/**
 * Switch the active instrument and begin preloading.
 * Can be called before any user gesture — sample loading
 * doesn't need the AudioContext to be running.
 */
export async function setInstrument(name) {
  activeInstrument = name;
  const ok = await ensureToneImported();
  if (!ok) return;
  if (name === "piano") loadPiano();
}

export function getActiveInstrument() {
  return activeInstrument;
}

export function isPianoLoaded() {
  return pianoReady;
}

export function isPianoLoading() {
  return pianoLoading && !pianoReady;
}

export function isReady() {
  if (activeInstrument === "synth") return toneImported;
  return pianoReady;
}

let playing = false;
let playingTimer = null;

export function isPlaying() {
  return playing;
}

function setPlaying(durationSec) {
  if (playingTimer) clearTimeout(playingTimer);
  playing = true;
  notifyListeners();
  playingTimer = setTimeout(() => {
    playing = false;
    playingTimer = null;
    notifyListeners();
  }, durationSec * 1000);
}

/* ── Playback functions ────────────────────────────────── */

export async function playChord(midiNotes, durationSec = 1.5) {
  if (!midiNotes || midiNotes.length === 0) return;
  const ok = await ensureToneImported();
  if (!ok) return;
  await ensureContextStarted();

  const inst = await getInstrument();
  const noteNames = midiNotes.map(midiToNoteName);
  const now = Tone.now();
  inst.triggerAttackRelease(noteNames, durationSec, now);
  setPlaying(durationSec);
}

export async function playArpeggio(midiNotes, staggerSec = 0.08, holdSec = 1.2) {
  if (!midiNotes || midiNotes.length === 0) return;
  const ok = await ensureToneImported();
  if (!ok) return;
  await ensureContextStarted();

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
  setPlaying(totalStagger + holdSec);
}