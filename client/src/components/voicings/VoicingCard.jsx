import { useMemo, useCallback } from "react";
import Piano from "../piano/Piano";
import FitToWidth from "../FitToWidth";
import { computeExpandedRange } from "../../lib/pianoRange";
import { WHITE_W } from "../../lib/pianoLayout";

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

  const octaveCount = 1 + leftOctaves + rightOctaves;
  const naturalWidth = octaveCount * 7 * WHITE_W;

  // 3) active keys must match what the Piano is rendering, so shift the midi in isActive
  const activeSet = useMemo(() => new Set(notesArr), [notesArr]);
  const isActive = useCallback(
    (midi) => activeSet.has(midi - shift),
    [activeSet, shift]
  );

  return (
    
    <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-3">
      <div className="text-sm text-slate-300">
        #{index + 1} • range: {notesArr[notesArr.length-1] - notesArr[0] + 1}
      </div>

      <div className="mt-3">
        <FitToWidth contentWidth={naturalWidth} allowUpscale={false} maxScale={0.9}>
          <Piano
            isActive={isActive}
            toggleMidi={() => {}}
            startMidi={startMidi}
            endMidi={endMidi}
          />
        </FitToWidth>
      </div>
    </div>
  );
}