import { useState } from "react";

export default function App() {

  const [active, setActive] = useState(null);

  const whiteKeys = ["C", "D", "E", "F", "G", "A", "B"];

  const blackKeys = [
    { name: "C#", between: "C" },
    { name: "D#", between: "D" },
    { name: "F#", between: "F" },
    { name: "G#", between: "G" },
    { name: "A#", between: "A" },
  ];

  // Each white key will have a fixed width; black keys position is based on that.
  // These are Tailwind size classes; you can tweak them.
  const WHITE_W = 64; // px (used only for inline style math)
  const BLACK_W = 40; // px
  const WHITE_H = 220; // px
  const BLACK_H = 140; // px

  // Map white key name -> its index in the white row
  const whiteIndex = {
    C: 0,
    D: 1,
    E: 2,
    F: 3,
    G: 4,
    A: 5,
    B: 6,
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <h1 className="text-2xl font-semibold">One Octave Piano</h1>
      <p className="mt-2 text-slate-300">
        Layout only: white keys in a row, black keys overlayed.
      </p>

      {/* Piano container: relative so black keys can be absolutely positioned inside */}
      <div className="mt-6">
        <div
          className="relative select-none"
          style={{
            width: `${whiteKeys.length * WHITE_W}px`,
            height: `${WHITE_H}px`,
          }}
        >
          {/* WHITE KEYS (bottom layer) */}
          <div className="flex h-full">
            {whiteKeys.map((k) => {
              const isActive = active === k;
              return (
                <button
                  key={k}
                  onClick={() => setActive(k)} // optional interaction
                  className={[
                    "relative border border-slate-300 text-slate-900",
                    "flex items-end justify-center",
                    "rounded-b-lg",
                    "transition-colors",
                    isActive ? "bg-cyan-300 hover:bg-cyan-200" : "bg-white hover:bg-slate-100",
                  ].join(" ")}
                  style={{ width: `${WHITE_W}px`, height: `${WHITE_H}px` }}
                >
                  <span className="mb-2 text-sm">{k}</span>
                </button>
              );
            })}
          </div>

          {/* BLACK KEYS (top layer) */}
          {/* pointer-events-none on the wrapper so only the buttons receive clicks */}
          <div className="pointer-events-none absolute left-0 top-0">
            {blackKeys.map((bk) => {
              const i = whiteIndex[bk.between]; // index of the white key to the left
              // Place the black key near the right edge of that white key
              const leftPx = (i + 1) * WHITE_W - BLACK_W / 2;

              const isActive = active === bk.name;
              return (
                <button
                  key={bk.name}
                  onClick={() => setActive(bk.name)} // optional interaction
                  className={[
                    "pointer-events-auto absolute",
                    "border border-black/60 text-slate-100",
                    "rounded-b-lg shadow",
                    "transition-colors",
                    isActive ? "bg-cyan-300 hover:bg-cyan-200" : "bg-slate-900 hover:bg-slate-800",
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

        {/* Optional debug text */}
        <div className="mt-4 text-sm text-slate-300">
          Active key: <span className="text-slate-100">{active ?? "none"}</span>
        </div>
      </div>
    </div>
  );
}