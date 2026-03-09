import { useMemo, useRef, useEffect, useCallback } from "react";
import { WHITE_W as DEFAULT_WHITE_W, BLACK_W as DEFAULT_BLACK_W, WHITE_H as DEFAULT_WHITE_H, BLACK_H as DEFAULT_BLACK_H, pcName, isWhitePc } from "../../lib/pianoLayout";
import WhiteKey from "./WhiteKey";
import BlackKey from "./BlackKey";

export default function Piano({
  isActive,
  toggleMidi,
  startMidi = 48, // C3
  endMidi = 71,   // B4
  whiteW = DEFAULT_WHITE_W,
  blackW = DEFAULT_BLACK_W,
  whiteH = DEFAULT_WHITE_H,
  blackH = DEFAULT_BLACK_H,
}) {
  /*  Drag state is kept in a ref so key handlers always see the
      latest value without needing re-renders on every mouse move.
      
      drag.current = null               → not dragging
      drag.current = { visited: Set }   → dragging                */
  const drag = useRef(null);

  /* End drag on global mouseup / mouseleave */
  useEffect(() => {
    const stop = () => { drag.current = null; };
    window.addEventListener("mouseup", stop);
    return () => window.removeEventListener("mouseup", stop);
  }, []);

  /* Called on mousedown over a key */
  const onKeyDown = useCallback((midi) => {
    drag.current = { visited: new Set([midi]) };
    toggleMidi(midi);
  }, [toggleMidi]);

  /* Called on mouseenter over a key while potentially dragging */
  const onKeyEnter = useCallback((midi) => {
    if (!drag.current) return;
    if (drag.current.visited.has(midi)) return;
    drag.current.visited.add(midi);
    toggleMidi(midi);
  }, [toggleMidi]);

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
        const betweenMidi = m - 1;
        if (!whitePosByMidi.has(betweenMidi)) continue;

        const whiteIndex = whitePosByMidi.get(betweenMidi);
        const leftPx = (whiteIndex + 1) * whiteW - blackW / 2;

        blacksLocal.push({ midi: m, label: pcName(m), leftPx });
      }
    }

    return { whites: whitesLocal, blacks: blacksLocal };
  }, [startMidi, endMidi, whiteW, blackW]);

  return (
    <div
      className="relative select-none"
      style={{
        width: `${whites.length * whiteW}px`,
        height: `${whiteH}px`,
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
            onMouseDown={() => onKeyDown(k.midi)}
            onMouseEnter={() => onKeyEnter(k.midi)}
            widthPx={whiteW}
            heightPx={whiteH}
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
            onMouseDown={() => onKeyDown(bk.midi)}
            onMouseEnter={() => onKeyEnter(bk.midi)}
            leftPx={bk.leftPx}
            widthPx={blackW}
            heightPx={blackH}
          />
        ))}
      </div>
    </div>
  );
}