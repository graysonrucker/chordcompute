import Piano from "./Piano";
import FitToWidth from "../FitToWidth";
import KeyboardSideControls from "./PianoSideControls";
import { WHITE_W } from "../../lib/pianoLayout";

export default function KeyboardPanel({ range, notes, loading, onGenerate }) {
  // 7 white keys per octave
  const octaveCount = 1 + range.leftOctaves + range.rightOctaves;
  const naturalWidth = octaveCount * 7 * WHITE_W;

  // Only allow upscaling for large spans
  const allowUpscale = octaveCount >= 6;

  return (
    <>
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

      <button
        className="mt-4 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded disabled:opacity-60"
        onClick={onGenerate}
        disabled={loading || notes.activeNotes.length === 0}
        title={notes.activeNotes.length === 0 ? "Select notes first" : ""}
      >
        {loading ? "Generating..." : "Generate"}
      </button>
    </>
  );
}