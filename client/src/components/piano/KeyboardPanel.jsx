import { useState, useMemo, useRef, useCallback } from "react";
import Piano from "./Piano";
import FitToWidth from "../FitToWidth";
import KeyboardSideControls from "./PianoSideControls";
import { WHITE_W, isWhitePc } from "../../lib/pianoLayout";
import { detectChord } from "../../lib/detectChord";
import { playArpeggio } from "../../lib/playback";
import { useSoundReady } from "../../hooks/useSoundReady";
import ChordTemplateDrawer from "../ChordTemplateDrawer";

function countWhiteKeys(startMidi, endMidi) {
  let count = 0;
  for (let m = startMidi; m <= endMidi; m++) {
    const pc = ((m % 12) + 12) % 12;
    if (isWhitePc(pc)) count++;
  }
  return count;
}

export default function KeyboardPanel({ range, notes, loading, onGenerate, bottomAsRoot }) {
  const [preferSharps, setPreferSharps] = useState(true);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateOverride, setTemplateOverride] = useState(null);
  const { ready: soundReady, loading: soundLoading, playing: soundPlaying } = useSoundReady();

  const whiteKeyCount = countWhiteKeys(range.startMidi, range.endMidi);
  const naturalWidth = whiteKeyCount * WHITE_W;

  /* Detected chord name — uses override if set, otherwise runs algorithm */
  const chordName = useMemo(() => {
    if (notes.activeNotes.length === 0) return null;
    if (templateOverride) return templateOverride;
    return detectChord(notes.activeNotes, preferSharps, bottomAsRoot);
  }, [notes.activeNotes, preferSharps, bottomAsRoot, templateOverride]);

  /* Wrap toggleMidi to clear template override on manual note changes */
  const handleToggleMidi = useCallback((midi) => {
    setTemplateOverride(null);
    notes.toggleMidi(midi);
  }, [notes.toggleMidi]);

  /* Wrap clear to also clear override */
  function handleClear() {
    setTemplateOverride(null);
    notes.clear();
  }

  /* Template apply — set notes, name override, and expand range */
  function handleTemplateApply(midiNotes, chordName) {
    range.ensureRange(midiNotes);
    notes.setActiveNotes(midiNotes);
    setTemplateOverride(chordName);
    setTemplateOpen(false);
  }

  return (
    <>
      <ChordTemplateDrawer
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        onApply={handleTemplateApply}
        preferSharps={preferSharps}
      />

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
            allowUpscale={countWhiteKeys(range.startMidi, range.endMidi) >= 21}
            maxScale={5}
            durationMs={320}
          >
            <Piano
              isActive={notes.isActive}
              toggleMidi={handleToggleMidi}
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

      {/* Controls row */}
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <button
          className={[
            "relative inline-flex items-center gap-2.5 px-6 py-2.5 rounded-lg font-medium text-sm tracking-wide",
            "transition-all duration-200 ease-out",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
            loading
              ? "bg-cyan-700/80 text-cyan-100 cursor-wait shadow-lg shadow-cyan-900/30"
              : notes.activeNotes.length === 0
                ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                : "bg-gradient-to-r from-cyan-600 to-cyan-500 text-white hover:from-cyan-500 hover:to-cyan-400 hover:shadow-lg hover:shadow-cyan-600/25 active:scale-[0.97]",
          ].join(" ")}
          onClick={onGenerate}
          disabled={loading || notes.activeNotes.length === 0}
          title={notes.activeNotes.length === 0 ? "Select notes first" : ""}
        >
          {loading && (
            <svg
              className="animate-spin-smooth h-4 w-4 text-cyan-200"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12" cy="12" r="10"
                stroke="currentColor"
                strokeWidth="3"
              />
              <path
                className="opacity-90"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z"
              />
            </svg>
          )}
          {loading ? "Generating…" : "Generate voicings"}
        </button>

        {/* Reset button */}
        <button
          onClick={handleClear}
          disabled={notes.activeNotes.length === 0}
          className={[
            "inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium",
            "border transition-all duration-150",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400",
            notes.activeNotes.length === 0
              ? "border-slate-800 bg-slate-900 text-slate-600 cursor-not-allowed"
              : "border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-slate-100 active:scale-[0.97]",
          ].join(" ")}
          title="Clear all selected notes"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
          Reset
        </button>

        {/* Play button */}
        {soundLoading ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium border border-slate-800 bg-slate-900 text-slate-500">
            <svg
              className="animate-spin-smooth h-3.5 w-3.5 text-slate-500"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z" />
            </svg>
            Loading sounds…
          </span>
        ) : (
          <button
            onClick={() => playArpeggio(notes.activeNotes)}
            disabled={notes.activeNotes.length === 0 || soundPlaying}
            className={[
              "inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium",
              "border transition-all duration-150",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400",
              notes.activeNotes.length === 0 || soundPlaying
                ? "border-slate-800 bg-slate-900 text-slate-600 cursor-not-allowed"
                : "border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-slate-100 active:scale-[0.97]",
            ].join(" ")}
            title={soundPlaying ? "Playing…" : "Play selected notes"}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
              fill="currentColor" stroke="none">
              <polygon points="6,3 20,12 6,21" />
            </svg>
            {soundPlaying ? "Playing…" : "Play"}
          </button>
        )}

        {/* Chord name display */}
        {notes.activeNotes.length >= 1 && (
          <span className="text-lg font-semibold text-slate-100 tracking-tight">
            {chordName ?? (
              <span className="text-slate-500 font-normal text-sm">
                Unknown chord
              </span>
            )}
          </span>
        )}

        {/* Chord template trigger */}
        <button
          onClick={() => setTemplateOpen(true)}
          className={[
            "ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium",
            "border border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700",
            "transition-colors duration-150",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400",
          ].join(" ")}
          title="Build a chord from a template"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
          </svg>
          Template
        </button>

        {/* ♯ / ♭ toggle */}
        <button
          onClick={() => setPreferSharps((v) => !v)}
          className={[
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium",
            "border transition-colors duration-150",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400",
            preferSharps
              ? "border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700"
              : "border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700",
          ].join(" ")}
          title={preferSharps ? "Showing sharps — click for flats" : "Showing flats — click for sharps"}
        >
          <span className={preferSharps ? "text-cyan-400" : "text-slate-500"}>♯</span>
          <span className="text-slate-600">/</span>
          <span className={!preferSharps ? "text-cyan-400" : "text-slate-500"}>♭</span>
        </button>
      </div>
    </>
  );
}