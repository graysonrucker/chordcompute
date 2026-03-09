import { useEffect, useMemo, useState } from "react";
import { useKeyboardRange } from "./hooks/useKeyboardRange";
import { useActiveNotes } from "./hooks/useActiveNotes";
import { useVoicingsQuery } from "./hooks/useVoicingsQuery";

import NavBar from "./components/NavBar";
import KeyboardPanel from "./components/piano/KeyboardPanel";
import VoicingsResults from "./components/voicings/VoicingResults";
import Pagination from "./components/Pagination";
import { WarningBanner, ErrorBanner, HaltedBanner } from "./components/StatusBanners";
import SettingsDrawer from "./components/SettingsDrawer";
import InfoPage from "./components/InfoPage";

function fmt(n) {
  return n?.toLocaleString() ?? "0";
}

export default function App() {
  const [activeTab, setActiveTab] = useState("generate");
  const [settingsOpen, setSettingsOpen] = useState(false);

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

  // Count of voicings actually on this page (mirrors the filter in VoicingResults)
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
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <NavBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onSettingsOpen={() => setSettingsOpen(true)}
      />
      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

      {activeTab === "generate" && (
        <div className="w-full px-2 sm:px-4 md:px-6 py-8">
          <KeyboardPanel
            range={range}
            notes={notes}
            loading={loading}
            onGenerate={() =>
              generate(notes.activeNotes, range.startMidi, range.endMidi)
            }
          />

          {/* Banners — only one shown at a time, in priority order */}
          {error && <ErrorBanner>{error}</ErrorBanner>}
          {isHalted && !error && (
            <HaltedBanner available={results?.available ?? 0} />
          )}
          {warning && !isHalted && !error && (
            <WarningBanner>{warning}</WarningBanner>
          )}

          {results && (
            <div className="mt-6 space-y-3">

              {/* Stats bar */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">

                {/* Total voicings */}
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

                {/* Showing range */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium uppercase tracking-widest text-slate-500">
                    Showing
                  </span>
                  <span className="font-mono text-lg font-semibold tabular-nums text-slate-100">
                    {fmt(pageFirst)}–{fmt(pageLast)}
                  </span>
                </div>

              </div>

              {/* Pagination */}
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
        </div>
      )}

      {activeTab === "info" && <InfoPage />}
    </div>
  );
}