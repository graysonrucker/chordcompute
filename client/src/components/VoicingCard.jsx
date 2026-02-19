import { useMemo } from "react";
import Piano from "./Piano";
import FitToWidth from "./FitToWidth";
import { WHITE_W } from "../lib/pianoLayout";

const BASE_START = 60; // C4
const BASE_END = 71;   // B4

function computeExpandedRange(notes) {
  const minNote = Math.min(...notes);
  const maxNote = Math.max(...notes);

  const leftOctaves = Math.max(0, Math.ceil((BASE_START - minNote) / 12));
  const rightOctaves = Math.max(0, Math.ceil((maxNote - BASE_END) / 12));

  const startMidi = BASE_START - leftOctaves * 12;
  const endMidi = BASE_END + rightOctaves * 12;

  return { startMidi, endMidi, leftOctaves, rightOctaves, minNote, maxNote };
}

export default function VoicingCard({ voicing, index }) {
  const notesArr = voicing.notes;

  const { startMidi, endMidi, leftOctaves, rightOctaves } = useMemo(
    () => computeExpandedRange(notesArr),
    [notesArr]
  );

  // candidates: 7 white keys per octave
  const octaveCount = 1 + leftOctaves + rightOctaves;
  const naturalWidth = octaveCount * 7 * WHITE_W;

  const activeSet = useMemo(() => new Set(notesArr), [notesArr]);
  const isActive = (midi) => activeSet.has(midi);

  return (
    <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-3">
      <div className="text-sm text-slate-300">
        #{index + 1} • span {voicing.span} • score {voicing.score}
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