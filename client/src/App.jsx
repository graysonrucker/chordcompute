// src/App.jsx
import { useEffect } from "react";
import { useState } from "react";
import Piano from "./components/Piano";
import FitToWidth from "./components/FitToWidth";
import KeyboardSideControls from "./components/KeyboardSideControls";
import { useKeyboardRange } from "./hooks/useKeyboardRange";
import { useActiveNotes } from "./hooks/useActiveNotes";
import { WHITE_W } from "./lib/pianoLayout";
import { fetchVoicings } from "./lib/api";

async function onGenerate() {
  setLoading(true);
  setError("");
  try {
    const data = await fetchVoicings({ notes: notes.activeNotes });
    setResults(data);
  } catch (e) {
    setError(e.message || "Failed to generate voicings");
  } finally {
    setLoading(false);
  }
}

export default function App() {
  const range = useKeyboardRange();
  const notes = useActiveNotes([]);

  // 7 white keys per octave
  const octaveCount = 1 + range.leftOctaves + range.rightOctaves;
  const naturalWidth = octaveCount * 7 * WHITE_W;

  // Only allow upscaling for large spans
  const allowUpscale = octaveCount >= 6;

  // Clear any selected notes that are no longer visible when the range changes
  useEffect(() => {
    notes.setActiveNotes((prev) =>
      prev.filter((m) => m >= range.startMidi && m <= range.endMidi)
    );
  }, [range.startMidi, range.endMidi, notes.setActiveNotes]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="w-full px-2 sm:px-4 md:px-6 py-8">
        <h1 className="text-2xl font-semibold">Piano</h1>
        <p className="mt-2 text-slate-300">
          Base octave: C4–B4. Expand left/right by octaves..
        </p>

        <div className="mt-6 w-full grid grid-cols-[3.25rem_minmax(0,1fr)_3.25rem] items-start gap-2">
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
            <FitToWidth
              contentWidth={naturalWidth}
              allowUpscale={allowUpscale}
              maxScale={1.6}
            >
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
          <button
            className="mt-4 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded"
            onClick={async () => {
              const res = await fetch("/api/voicings", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ notes: notes.activeNotes }),
            });
          const data = await res.json();
          console.log(data);
          }}
        >
          Generate
          </button>
      </div>
    </div>
    
  );
}