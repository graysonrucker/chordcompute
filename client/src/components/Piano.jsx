import { useMemo } from "react";
import {
  WHITE_W,
  BLACK_W,
  WHITE_H,
  BLACK_H,
  pcName,
  isWhitePc,
} from "../lib/pianoLayout";

export default function Piano({
  activeNotes,
  setActiveNotes,
  startMidi = 60, // C4
  endMidi = 71,   // B4
}) {
  function isActive(midi) {
    return activeNotes.includes(midi);
  }

  function toggleMidi(midi) {
    setActiveNotes((prev) =>
      prev.includes(midi) ? prev.filter((n) => n !== midi) : [...prev, midi]
    );
  }

  const { whites, blacks } = useMemo(() => {
    const whitesLocal = [];
    const blacksLocal = [];
    const whitePosByMidi = new Map();

    // collect whites
    for (let m = startMidi; m <= endMidi; m++) {
      const pc = ((m % 12) + 12) % 12;
      if (isWhitePc(pc)) {
        const xIndex = whitesLocal.length;
        whitesLocal.push({ midi: m, label: pcName(m) });
        whitePosByMidi.set(m, xIndex);
      }
    }

    // collect blacks
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
        {whites.map((k) => {
          const active = isActive(k.midi);
          return (
            <button
              key={k.midi}
              onClick={() => toggleMidi(k.midi)}
              className={[
                "relative border border-slate-300 text-slate-900",
                "flex items-end justify-center",
                "rounded-b-lg",
                "transition-colors",
                active ? "bg-cyan-300 hover:bg-cyan-200" : "bg-white hover:bg-slate-100",
              ].join(" ")}
              style={{ width: `${WHITE_W}px`, height: `${WHITE_H}px` }}
              title={`${k.label} (MIDI ${k.midi})`}
            >
              <span className="mb-2 text-sm">{k.label}</span>
            </button>
          );
        })}
      </div>

      {/* BLACK KEYS */}
      <div className="pointer-events-none absolute left-0 top-0">
        {blacks.map((bk) => {
          const active = isActive(bk.midi);
          return (
            <button
              key={bk.midi}
              onClick={() => toggleMidi(bk.midi)}
              className={[
                "pointer-events-auto absolute",
                "border border-black/60 text-slate-100",
                "rounded-b-lg shadow",
                "transition-colors",
                active ? "bg-cyan-300 hover:bg-cyan-200" : "bg-slate-900 hover:bg-slate-800",
              ].join(" ")}
              style={{
                left: `${bk.leftPx}px`,
                width: `${BLACK_W}px`,
                height: `${BLACK_H}px`,
              }}
              title={`${bk.label} (MIDI ${bk.midi})`}
            >
              <span className="sr-only">{bk.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}