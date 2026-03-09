import { useEffect, useMemo, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useKeyboardRange } from "./hooks/useKeyboardRange";
import { useActiveNotes } from "./hooks/useActiveNotes";
import { useVoicingsQuery } from "./hooks/useVoicingsQuery";

import NavBar from "./components/NavBar";
import KeyboardPanel from "./components/piano/KeyboardPanel";
import VoicingsResults from "./components/voicings/VoicingResults";
import Pagination from "./components/Pagination";
import { WarningBanner, ErrorBanner, HaltedBanner } from "./components/StatusBanners";
import SettingsDrawer from "./components/SettingsDrawer";
import ScrollToTop from "./components/ScrollToTop";
import InfoPage from "./components/InfoPage";

function fmt(n) {
  return n?.toLocaleString() ?? "0";
}

function GeneratePage() {
  const range = useKeyboardRange();
  const notes = useActiveNotes([]);

  const {
    results,
    loading,
    pageLoading,
    error,
    warning,
    isHalted,
    generate,
    goToPage,
    currentPage,
    totalPages,
    availablePages,
    isStreaming,
  } = useVoicingsQuery();

  useEffect(() => {
    notes.setActiveNotes((prev) =>
      prev.filter((m) => m >= range.startMidi && m <= range.endMidi)
    );
  }, [range.startMidi, range.endMidi, notes.setActiveNotes]);

  const pageCount = useMemo(
    () =>
      (results?.voicings ?? []).filter(
        (v) => Array.isArray(v.notes) && v.notes.length
      ).length,
    [results?.voicings]
  );

  const pageFirst = results ? results.offset + 1 : 0;
  const pageLast  = results ? results.offset + pageCount : 0;

  return (
    <div className="w-full px-2 sm:px-4 md:px-6 py-8">
      <KeyboardPanel
        range={range}
        notes={notes}
        loading={loading}
        onGenerate={() =>
          generate(notes.activeNotes, range.startMidi, range.endMidi)
        }
      />

      {error && <ErrorBanner>{error}</ErrorBanner>}
      {isHalted && !error && (
        <HaltedBanner available={results?.available ?? 0} />
      )}
      {warning && !isHalted && !error && (
        <WarningBanner>{warning}</WarningBanner>
      )}

      {results && (
        <div className="mt-6 space-y-3">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-widest text-slate-500">
                Total
              </span>
              <span className="font-mono text-lg font-semibold tabular-nums text-slate-100">
                {fmt(isStreaming ? results.available : results.count)}
                {isStreaming && <span className="text-slate-400">+</span>}
              </span>
              {isStreaming && (
                <span
                  className="inline-block h-2 w-2 rounded-full bg-blue-400 animate-pulse"
                  title="Still generating"
                />
              )}
            </div>

            <span className="text-slate-700 select-none">|</span>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-widest text-slate-500">
                Showing
              </span>
              <span className="font-mono text-lg font-semibold tabular-nums text-slate-100">
                {fmt(pageFirst)}–{fmt(pageLast)}
              </span>
            </div>
          </div>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            availablePages={availablePages}
            isStreaming={isStreaming}
            disabled={loading || pageLoading}
            onPageChange={goToPage}
          />
        </div>
      )}

      <VoicingsResults results={results} />
      <ScrollToTop />
    </div>
  );
}

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <NavBar onSettingsOpen={() => setSettingsOpen(true)} />
      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

      <Routes>
        <Route path="/" element={<GeneratePage />} />
        <Route path="/info" element={<InfoPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}