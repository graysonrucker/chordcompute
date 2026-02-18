import { useState } from "react";
import Piano from "./components/Piano";
import FitToWidth from "./components/FitToWidth";
import { useKeyboardRange } from "./hooks/useKeyboardRange";

const WHITE_W = 64;

export default function App() {
  const [activeNotes, setActiveNotes] = useState([]); // MIDI numbers
  const range = useKeyboardRange();

  // Approximate natural width: 7 white keys per octave * WHITE_W.
  // (This is slightly off only at the extreme A0–B0 and C8 edges, but works well.)
  const octaveCount = 1 + range.leftOctaves + range.rightOctaves;
  const naturalWidth = octaveCount * 7 * WHITE_W;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto w-full max-w-5xl px-4 py-8">
        <h1 className="text-2xl font-semibold">Piano</h1>
        <p className="mt-2 text-slate-300">
          Base octave: C4–B4. Expand left/right by octaves (clamped to A0–C8).
        </p>

        {/* Controls flanking the piano + piano that always fits */}
        <div className="mt-6 flex items-start justify-center gap-4 w-full">
          {/* LEFT CONTROLS */}
          <div className="flex flex-col items-center shrink-0">
            <button
              onClick={range.addLeft}
              disabled={!range.canAddLeft}
              className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Add an octave on the left"
            >
              +
            </button>

            {range.leftOctaves > 0 && (
              <button
                onClick={range.removeLeft}
                className="mt-2 px-3 py-1 rounded bg-slate-800 hover:bg-slate-700"
                title="Remove an octave from the left"
              >
                −
              </button>
            )}
          </div>

          {/* PIANO (min-w-0 is critical so the center column can shrink) */}
          <div className="flex-1 min-w-0">
            <FitToWidth contentWidth={naturalWidth}>
              <Piano
                activeNotes={activeNotes}
                setActiveNotes={setActiveNotes}
                startMidi={range.startMidi}
                endMidi={range.endMidi}
              />
            </FitToWidth>
          </div>

          {/* RIGHT CONTROLS */}
          <div className="flex flex-col items-center shrink-0">
            <button
              onClick={range.addRight}
              disabled={!range.canAddRight}
              className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Add an octave on the right"
            >
              +
            </button>

            {range.rightOctaves > 0 && (
              <button
                onClick={range.removeRight}
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
            MIDI {range.startMidi}–{range.endMidi}
          </span>
        </div>

        <div className="mt-2 text-sm text-slate-300">
          Active notes (MIDI):{" "}
          <span className="text-slate-100">
            {activeNotes.length ? activeNotes.join(", ") : "none"}
          </span>
        </div>
      </div>
    </div>
  );
}