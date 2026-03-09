import { useMemo, useCallback } from "react";
import Piano from "../piano/Piano";
import FitToWidth from "../FitToWidth";
import { computeExpandedRange } from "../../lib/pianoRange";
import { keyDimensions } from "../../lib/pianoLayout";
import { playArpeggio } from "../../lib/playback";

const UI_CENTER = 60; // C4. Change if your UI wants a different "home".

function mean(arr) {
  let s = 0;
  for (const x of arr) s += x;
  return s / arr.length;
}

// Returns { shiftedNotes, shift }
function shiftToUiCenterByOctave(notes, uiCenter = UI_CENTER) {
  if (!notes?.length) return { shiftedNotes: notes, shift: 0 };

  const c = mean(notes);
  const k = Math.round((uiCenter - c) / 12);
  const shift = k * 12;

  return { shiftedNotes: notes.map(n => n + shift), shift };
}

export default function VoicingCard({ voicing, index }) {
  const notesArr = voicing.notes;

  // 1) compute a display-shifted version ONLY for range/layout
  const { shiftedNotes, shift } = useMemo(
    () => shiftToUiCenterByOctave(notesArr, UI_CENTER),
    [notesArr]
  );

  // 2) range/layout is based on shifted notes
  const { startMidi, endMidi, leftOctaves, rightOctaves } = useMemo(
    () => computeExpandedRange(shiftedNotes),
    [shiftedNotes]
  );

  const octaveCount = 2 + leftOctaves + rightOctaves;
  const { whiteW, blackW, whiteH, blackH } = keyDimensions(octaveCount);
  const naturalWidth = octaveCount * 7 * whiteW;

  // 3) active keys must match what the Piano is rendering, so shift the midi in isActive
  const activeSet = useMemo(() => new Set(notesArr), [notesArr]);
  const isActive = useCallback(
    (midi) => activeSet.has(midi - shift),
    [activeSet, shift]
  );

  const range = notesArr[notesArr.length - 1] - notesArr[0] + 1;

  return (
    <div className="animate-fade-in-up rounded-xl bg-slate-900/60 border border-slate-800/80 p-3 hover:border-slate-700/60 transition-colors duration-200">
      <div className="flex items-center gap-2 text-sm">
        <span className="font-mono text-slate-500 text-xs tabular-nums">
          #{index + 1}
        </span>
        <span className="text-slate-400">
          range: <span className="text-slate-300 font-medium">{range}</span>
        </span>
        <button
          onClick={() => playArpeggio(notesArr)}
          className="ml-auto inline-flex items-center justify-center w-7 h-7 rounded-md text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors duration-150"
          title="Play voicing"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"
            fill="currentColor" stroke="none">
            <polygon points="6,3 20,12 6,21" />
          </svg>
        </button>
      </div>

      <div className="mt-3">
        <FitToWidth contentWidth={naturalWidth} allowUpscale={false} maxScale={0.9}>
          <Piano
            isActive={isActive}
            toggleMidi={() => {}}
            startMidi={startMidi}
            endMidi={endMidi}
            whiteW={whiteW}
            blackW={blackW}
            whiteH={whiteH}
            blackH={blackH}
          />
        </FitToWidth>
      </div>
    </div>
  );
}