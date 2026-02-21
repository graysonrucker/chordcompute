import { useMemo, useCallback } from "react";
import Piano from "../piano/Piano";
import FitToWidth from "../FitToWidth";
import { computeExpandedRange } from "../../lib/pianoRange";
import { WHITE_W } from "../../lib/pianoLayout";


export default function VoicingCard({ voicing, index }) {
  console.count("VoicingCard render");
  const notesArr = voicing.notes;

  const { startMidi, endMidi, leftOctaves, rightOctaves } = useMemo(
    () => computeExpandedRange(notesArr),
    [notesArr]
  );

  const octaveCount = 1 + leftOctaves + rightOctaves;
  const naturalWidth = octaveCount * 7 * WHITE_W;

  const activeSet = useMemo(() => new Set(notesArr), [notesArr]);
  const isActive = useCallback((midi) => activeSet.has(midi), [activeSet]);

  return (
    <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-3">
      <div className="text-sm text-slate-300">
        #{index + 1} • span {voicing.span}
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

      <div className="mt-2 font-mono text-xs text-slate-400">
        [{notesArr.join(", ")}]
      </div>
    </div>
  );
}