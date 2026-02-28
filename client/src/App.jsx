import { useEffect } from "react";
import { useKeyboardRange } from "./hooks/useKeyboardRange";
import { useActiveNotes } from "./hooks/useActiveNotes";
import { useVoicingsQuery } from "./hooks/useVoicingsQuery";

import KeyboardPanel from "./components/piano/KeyboardPanel";
import VoicingsResults from "./components/voicings/VoicingResults";

export default function App() {
  const range = useKeyboardRange();
  const notes = useActiveNotes([]);

  const {
    results,
    loading,
    pageLoading,
    error,
    generate,
    nextPage,
    prevPage,
    canPrev,
    canNext,
  } = useVoicingsQuery();

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
          Base octave: C4–B4. Expand left/right by octaves.
        </p>

        <KeyboardPanel
          range={range}
          notes={notes}
          loading={loading}
          onGenerate={() => generate(notes.activeNotes)}
        />

        {error && <div className="mt-4 text-red-300">{error}</div>}

        {results && (
          <div className="mt-6 flex items-center gap-2">
            <button
              className="rounded bg-slate-800 px-3 py-1 text-slate-100 disabled:opacity-50"
              onClick={prevPage}
              disabled={!canPrev || loading || pageLoading}
            >
              Prev
            </button>

            <button
              className="rounded bg-slate-800 px-3 py-1 text-slate-100 disabled:opacity-50"
              onClick={nextPage}
              disabled={!canNext || loading || pageLoading}
            >
              Next
            </button>

            <div className="ml-3 text-slate-300">
              Showing {results.offset + 1}–
              {Math.min(results.offset + results.limit, results.count)} of {results.count}
            </div>
          </div>
        )}

        <VoicingsResults results={results} />
      </div>
    </div>
  );
}