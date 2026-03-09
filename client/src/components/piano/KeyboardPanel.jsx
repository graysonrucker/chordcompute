import Piano from "./Piano";
import FitToWidth from "../FitToWidth";
import KeyboardSideControls from "./PianoSideControls";
import { WHITE_W, isWhitePc } from "../../lib/pianoLayout";

function countWhiteKeys(startMidi, endMidi) {
  let count = 0;
  for (let m = startMidi; m <= endMidi; m++) {
    const pc = ((m % 12) + 12) % 12;
    if (isWhitePc(pc)) count++;
  }
  return count;
}

export default function KeyboardPanel({ range, notes, loading, onGenerate }) {
  const whiteKeyCount = countWhiteKeys(range.startMidi, range.endMidi);
  const naturalWidth = whiteKeyCount * WHITE_W;

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
            allowUpscale={countWhiteKeys(range.startMidi, range.endMidi) >= 21}
            maxScale={5}
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