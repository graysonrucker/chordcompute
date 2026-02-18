// src/App.jsx
import { useMemo } from "react";
import Piano from "./components/Piano";
import FitToWidth from "./components/FitToWidth";
import KeyboardSideControls from "./components/KeyboardSideControls";
import { useKeyboardRange } from "./hooks/useKeyboardRange";
import { useActiveNotes } from "./hooks/useActiveNotes";
import { WHITE_W } from "./lib/pianoLayout";

export default function App() {
  const range = useKeyboardRange();
  const notes = useActiveNotes([]);

  // 7 white keys per octave
  const naturalWidth = useMemo(() => {
    const octaveCount = 1 + range.leftOctaves + range.rightOctaves;
    return octaveCount * 7 * WHITE_W;
  }, [range.leftOctaves, range.rightOctaves]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto w-full max-w-5xl px-4 py-8">
        <h1 className="text-2xl font-semibold">Piano</h1>
        <p className="mt-2 text-slate-300">
          Base octave: C4–B4. Expand left/right by octaves (clamped to A0–C8).
        </p>

        {/* 3-column grid with equal fixed side columns ensures true centering */}
        <div className="mt-6 w-full grid grid-cols-[3.5rem_minmax(0,1fr)_3.5rem] items-start gap-4">
          {/* LEFT */}
          <div className="flex justify-center">
            <KeyboardSideControls
              canAdd={range.canAddLeft}
              canRemove={range.leftOctaves > 0}
              onAdd={range.addLeft}
              onRemove={range.removeLeft}
            />
          </div>

          {/* CENTER */}
          <div className="min-w-0">
            <FitToWidth contentWidth={naturalWidth}>
              <Piano
                isActive={notes.isActive}
                toggleMidi={notes.toggleMidi}
                startMidi={range.startMidi}
                endMidi={range.endMidi}
              />
            </FitToWidth>
          </div>

          {/* RIGHT */}
          <div className="flex justify-center">
            <KeyboardSideControls
              canAdd={range.canAddRight}
              canRemove={range.rightOctaves > 0}
              onAdd={range.addRight}
              onRemove={range.removeRight}
            />
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
            {notes.activeNotes.length ? notes.activeNotes.join(", ") : "none"}
          </span>
        </div>
      </div>
    </div>
  );
}