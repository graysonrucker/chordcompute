const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function pcName(midi) {
  const pc = ((midi % 12) + 12) % 12;
  return NOTE_NAMES[pc];
}

function isWhitePc(pc) {
  return pc === 0 || pc === 2 || pc === 4 || pc === 5 || pc === 7 || pc === 9 || pc === 11;
}

export default function Piano({
  activeNotes,
  setActiveNotes,
  startMidi = 60, // default C4
  endMidi = 71,   // default B4
}) {
  const WHITE_W = 64;
  const BLACK_W = 40;
  const WHITE_H = 220;
  const BLACK_H = 140;

  function isActive(midi) {
    return activeNotes.includes(midi);
  }

  function toggleMidi(midi) {
    setActiveNotes((prev) =>
      prev.includes(midi) ? prev.filter((n) => n !== midi) : [...prev, midi]
    );
  }

  // Build keys for the visible MIDI range
  const whites = [];
  const blacks = [];

  // Map from a "between white midi" to its x index (white key position)
  // Example: for C# we want it between C and D, so "betweenMidi" is C's midi.
  const whitePosByMidi = new Map();

  // First pass: collect whites and record their positions
  for (let m = startMidi; m <= endMidi; m++) {
    const pc = ((m % 12) + 12) % 12;
    if (isWhitePc(pc)) {
      const xIndex = whites.length;
      whites.push({ midi: m, label: pcName(m) });
      whitePosByMidi.set(m, xIndex);
    }
  }

  // Second pass: collect blacks with positioning info
  for (let m = startMidi; m <= endMidi; m++) {
    const pc = ((m % 12) + 12) % 12;
    if (!isWhitePc(pc)) {
      const label = pcName(m);

      // Determine which white key it sits "between" by using the previous white midi.
      const betweenMidi = m - 1;

      // If the between white isn't in range (can happen at edges), skip rendering this black key.
      if (!whitePosByMidi.has(betweenMidi)) continue;

      const whiteIndex = whitePosByMidi.get(betweenMidi);
      const leftPx = (whiteIndex + 1) * WHITE_W - BLACK_W / 2;

      blacks.push({ midi: m, label, leftPx });
    }
  }

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
                active
                  ? "bg-cyan-300 hover:bg-cyan-200"
                  : "bg-white hover:bg-slate-100",
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
                active
                  ? "bg-cyan-300 hover:bg-cyan-200"
                  : "bg-slate-900 hover:bg-slate-800",
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