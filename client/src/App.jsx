import { useMemo, useState } from "react";
import Piano from "./components/Piano";

//**REFACTOR THIS**//

const MIDI_MIN = 21;   // A0
const MIDI_MAX = 108;  // C8
const BASE_START = 60; // C4
const BASE_END = 71;   // B4

export default function App() {
  const [activeNotes, setActiveNotes] = useState([]); // MIDI numbers
  const [leftOctaves, setLeftOctaves] = useState(0);
  const [rightOctaves, setRightOctaves] = useState(0);

  // Maximum expansions allowed before we'd exceed the 88-key window
  const maxLeftOctaves = useMemo(
    () => Math.ceil((BASE_START - MIDI_MIN) / 12),
    []
  );
  const maxRightOctaves = useMemo(
    () => Math.ceil((MIDI_MAX - BASE_END) / 12),
    []
  );

  // Compute visible range, clamped to the real piano
  const unclampedStart = BASE_START - 12 * leftOctaves;
  const unclampedEnd = BASE_END + 12 * rightOctaves;

  const startMidi = Math.max(MIDI_MIN, unclampedStart);
  const endMidi = Math.min(MIDI_MAX, unclampedEnd);

  function clampSelectionsToRange(lo, hi) {
    setActiveNotes((prev) => prev.filter((m) => m >= lo && m <= hi));
  }

  function addLeft() {
    setLeftOctaves((v) => Math.min(maxLeftOctaves, v + 1));
  }

  function removeLeft() {
    setLeftOctaves((v) => {
      const next = Math.max(0, v - 1);

      // compute NEXT range after removing
      const nextUnclampedStart = BASE_START - 12 * next;
      const nextStart = Math.max(MIDI_MIN, nextUnclampedStart);
      const nextEnd = Math.min(MIDI_MAX, BASE_END + 12 * rightOctaves);

      clampSelectionsToRange(nextStart, nextEnd);
      return next;
    });
  }

  function addRight() {
    setRightOctaves((v) => Math.min(maxRightOctaves, v + 1));
  }

  function removeRight() {
    setRightOctaves((v) => {
      const next = Math.max(0, v - 1);

      // compute NEXT range after removing
      const nextStart = Math.max(MIDI_MIN, BASE_START - 12 * leftOctaves);
      const nextUnclampedEnd = BASE_END + 12 * next;
      const nextEnd = Math.min(MIDI_MAX, nextUnclampedEnd);

      clampSelectionsToRange(nextStart, nextEnd);
      return next;
    });
  }

  const canAddLeft = leftOctaves < maxLeftOctaves;
  const canAddRight = rightOctaves < maxRightOctaves;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center p-8">
      <h1 className="text-2xl font-semibold">Piano</h1>
      <p className="mt-2 text-slate-300">
        Base octave: C4–B4. Expand left/right by octaves (clamped to A0–C8).
      </p>

      <div className="mt-6 flex items-start gap-4">
        {/* LEFT controls */}
        <div className="flex flex-col items-center">
          <button
            onClick={addLeft}
            disabled={!canAddLeft}
            className={[
              "px-3 py-1 rounded bg-slate-800 hover:bg-slate-700",
              "disabled:opacity-40 disabled:cursor-not-allowed",
            ].join(" ")}
            title="Add an octave on the left"
          >
            +
          </button>

          {leftOctaves > 0 && (
            <button
              onClick={removeLeft}
              className="mt-2 px-3 py-1 rounded bg-slate-800 hover:bg-slate-700"
              title="Remove an octave from the left"
            >
              −
            </button>
          )}
        </div>

        {/* PIANO (wrap in overflow-x-auto when it gets wide) */}
        <div className="max-w-full overflow-x-auto">
          <Piano
            activeNotes={activeNotes}
            setActiveNotes={setActiveNotes}
            startMidi={startMidi}
            endMidi={endMidi}
          />
        </div>

        {/* RIGHT controls */}
        <div className="flex flex-col items-center">
          <button
            onClick={addRight}
            disabled={!canAddRight}
            className={[
              "px-3 py-1 rounded bg-slate-800 hover:bg-slate-700",
              "disabled:opacity-40 disabled:cursor-not-allowed",
            ].join(" ")}
            title="Add an octave on the right"
          >
            +
          </button>

          {rightOctaves > 0 && (
            <button
              onClick={removeRight}
              className="mt-2 px-3 py-1 rounded bg-slate-800 hover:bg-slate-700"
              title="Remove an octave from the right"
            >
              −
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 text-sm text-slate-300">
        Range:{" "}
        <span className="text-slate-100">
          MIDI {startMidi}–{endMidi}
        </span>
      </div>

      <div className="mt-2 text-sm text-slate-300">
        Active notes (MIDI):{" "}
        <span className="text-slate-100">
          {activeNotes.length ? activeNotes.join(", ") : "none"}
        </span>
      </div>
    </div>
  );
}