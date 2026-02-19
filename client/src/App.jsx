// src/App.jsx
import { useEffect, useState } from "react";
import Piano from "./components/Piano";
import FitToWidth from "./components/FitToWidth";
import KeyboardSideControls from "./components/KeyboardSideControls";
import { useKeyboardRange } from "./hooks/useKeyboardRange";
import { useActiveNotes } from "./hooks/useActiveNotes";
import { WHITE_W } from "./lib/pianoLayout";
import { fetchVoicings } from "./lib/api";

const BASE_START = 60; // C4
const BASE_END = 71;   // B4

function makeIsActiveFromNotes(noteList) {
  const set = new Set(noteList);
  return (midi) => set.has(midi);
}

function computeResultRange(voicingNotes) {
  const minNote = Math.min(...voicingNotes);
  const maxNote = Math.max(...voicingNotes);

  const leftOctaves = Math.max(0, Math.ceil((BASE_START - minNote) / 12));
  const rightOctaves = Math.max(0, Math.ceil((maxNote - BASE_END) / 12));

  const startMidi = BASE_START - leftOctaves * 12;
  const endMidi = BASE_END + rightOctaves * 12;

  const octaveCount = 1 + leftOctaves + rightOctaves;
  const naturalWidth = octaveCount * 7 * WHITE_W;

  return { startMidi, endMidi, naturalWidth };
}

export default function App() {
  const range = useKeyboardRange();
  const notes = useActiveNotes([]);

  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

  async function onGenerate() {
    setLoading(true);
    setError("");
    try {
      const data = await fetchVoicings({ notes: notes.activeNotes });
      setResults(data);
    } catch (e) {
      setResults(null);
      setError(e.message || "Failed to generate voicings");
    } finally {
      setLoading(false);
    }
  }

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
          className="mt-4 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded disabled:opacity-60"
          onClick={onGenerate}
          disabled={loading || notes.activeNotes.length === 0}
          title={notes.activeNotes.length === 0 ? "Select notes first" : ""}
        >
          {loading ? "Generating..." : "Generate"}
        </button>

        {error && <div className="mt-4 text-red-300">{error}</div>}

        {results && (
          <div className="mt-6">
            <div className="text-slate-300">
              Found{" "}
              <span className="text-slate-100 font-semibold">
                {results.totalFound}
              </span>{" "}
              voicings (showing {results.voicings.length})
              {results.truncatedBecauseComboCap ? (
                <span className="text-amber-300"> — truncated</span>
              ) : null}
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              {(results.voicings || [])
                .filter((v) => Array.isArray(v.notes) && v.notes.length)
                .map((v, i) => {
                  const { startMidi, endMidi, naturalWidth: resWidth } =
                    computeResultRange(v.notes);

                  return (
                    <div
                      key={i}
                      className="rounded-xl bg-slate-900/60 border border-slate-800 p-3"
                    >
                      <div className="text-sm text-slate-300">
                        #{i + 1} • span {v.span} • score {v.score}
                      </div>

                      <div className="mt-3">
                        <FitToWidth
                          contentWidth={resWidth}
                          allowUpscale={false}
                          maxScale={0.95}
                        >
                          <Piano
                            isActive={makeIsActiveFromNotes(v.notes)}
                            toggleMidi={() => {}}
                            startMidi={startMidi}
                            endMidi={endMidi}
                          />
                        </FitToWidth>
                      </div>

                      <div className="mt-2 font-mono text-xs text-slate-400">
                        [{v.notes.join(", ")}]
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}