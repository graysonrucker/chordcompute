// src/components/Piano.jsx
import { useMemo } from "react";
import { WHITE_W, BLACK_W, WHITE_H, BLACK_H, pcName, isWhitePc } from "../../lib/pianoLayout";
import WhiteKey from "./WhiteKey";
import BlackKey from "./BlackKey";

export default function Piano({
  isActive,
  toggleMidi,
  startMidi = 60, // C4
  endMidi = 71,   // B4
}) {
  const { whites, blacks } = useMemo(() => {
    const whitesLocal = [];
    const blacksLocal = [];
    const whitePosByMidi = new Map();

    for (let m = startMidi; m <= endMidi; m++) {
      const pc = ((m % 12) + 12) % 12;
      if (isWhitePc(pc)) {
        const xIndex = whitesLocal.length;
        whitesLocal.push({ midi: m, label: pcName(m) });
        whitePosByMidi.set(m, xIndex);
      }
    }

    for (let m = startMidi; m <= endMidi; m++) {
      const pc = ((m % 12) + 12) % 12;
      if (!isWhitePc(pc)) {
        const betweenMidi = m - 1; // black sits after previous white
        if (!whitePosByMidi.has(betweenMidi)) continue;

        const whiteIndex = whitePosByMidi.get(betweenMidi);
        const leftPx = (whiteIndex + 1) * WHITE_W - BLACK_W / 2;

        blacksLocal.push({ midi: m, label: pcName(m), leftPx });
      }
    }

    return { whites: whitesLocal, blacks: blacksLocal };
  }, [startMidi, endMidi]);

  return (
    <div
      className="relative select-none"
      style={{
        width: `${whites.length * WHITE_W}px`,
        height: `${WHITE_H}px`,
      }}
    >
      {/* WHITE KEYS */}
      <div className="flex h-full">
        {whites.map((k) => (
          <WhiteKey
            key={k.midi}
            midi={k.midi}
            label={k.label}
            active={isActive(k.midi)}
            onClick={() => toggleMidi(k.midi)}
            widthPx={WHITE_W}
            heightPx={WHITE_H}
          />
        ))}
      </div>

      {/* BLACK KEYS */}
      <div className="pointer-events-none absolute left-0 top-0">
        {blacks.map((bk) => (
          <BlackKey
            key={bk.midi}
            midi={bk.midi}
            label={bk.label}
            active={isActive(bk.midi)}
            onClick={() => toggleMidi(bk.midi)}
            leftPx={bk.leftPx}
            widthPx={BLACK_W}
            heightPx={BLACK_H}
          />
        ))}
      </div>
    </div>
  );
}