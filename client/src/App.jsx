// src/App.jsx
import { useState, useMemo } from "react";
import Piano, { WHITE_W } from "./components/Piano";
import FitToWidth from "./components/FitToWidth";
import KeyboardControls from "./components/KeyboardControls";
import { useKeyboardRange } from "./hooks/useKeyboardRange";

export default function App() {
  const [activeNotes, setActiveNotes] = useState([]); // MIDI numbers
  const range = useKeyboardRange();

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

        <div className="mt-6 flex items-start justify-center gap-4 w-full">
          <KeyboardControls
            leftOctaves={range.leftOctaves}
            rightOctaves={range.rightOctaves}
            canAddLeft={range.canAddLeft}
            canAddRight={range.canAddRight}
            addLeft={range.addLeft}
            removeLeft={range.removeLeft}
            addRight={range.addRight}
            removeRight={range.removeRight}
          />

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