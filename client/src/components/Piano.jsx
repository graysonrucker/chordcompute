export default function Piano({ active, setActive }) {
  const whiteKeys = ["C", "D", "E", "F", "G", "A", "B"];

  const blackKeys = [
    { name: "C#", between: "C" },
    { name: "D#", between: "D" },
    { name: "F#", between: "F" },
    { name: "G#", between: "G" },
    { name: "A#", between: "A" },
  ];

  const WHITE_W = 64;
  const BLACK_W = 40;
  const WHITE_H = 220;
  const BLACK_H = 140;

  const whiteIndex = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };

  return (
    <div
      className="relative select-none"
      style={{
        width: `${whiteKeys.length * WHITE_W}px`,
        height: `${WHITE_H}px`,
      }}
    >
      {/* WHITE KEYS */}
      <div className="flex h-full">
        {whiteKeys.map((k) => {
          const isActive = active === k;
          return (
            <button
              key={k}
              onClick={() => setActive(k)}
              className={[
                "relative border border-slate-300 text-slate-900",
                "flex items-end justify-center",
                "rounded-b-lg",
                "transition-colors",
                isActive
                  ? "bg-cyan-300 hover:bg-cyan-200"
                  : "bg-white hover:bg-slate-100",
              ].join(" ")}
              style={{ width: `${WHITE_W}px`, height: `${WHITE_H}px` }}
            >
              <span className="mb-2 text-sm">{k}</span>
            </button>
          );
        })}
      </div>

      {/* BLACK KEYS */}
      <div className="pointer-events-none absolute left-0 top-0">
        {blackKeys.map((bk) => {
          const i = whiteIndex[bk.between];
          const leftPx = (i + 1) * WHITE_W - BLACK_W / 2;

          const isActive = active === bk.name;
          return (
            <button
              key={bk.name}
              onClick={() => setActive(bk.name)}
              className={[
                "pointer-events-auto absolute",
                "border border-black/60 text-slate-100",
                "rounded-b-lg shadow",
                "transition-colors",
                isActive
                  ? "bg-cyan-300 hover:bg-cyan-200"
                  : "bg-slate-900 hover:bg-slate-800",
              ].join(" ")}
              style={{
                left: `${leftPx}px`,
                width: `${BLACK_W}px`,
                height: `${BLACK_H}px`,
              }}
            >
              <span className="sr-only">{bk.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}