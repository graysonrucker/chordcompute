import { useState } from "react";
import Piano from "./components/Piano";

export default function App() {
  const [active, setActive] = useState(null);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-8">
      <h1 className="text-2xl font-semibold">One Octave Piano</h1>
      <p className="mt-2 text-slate-300">
        Layout only: white keys in a row, black keys overlayed.
      </p>

      <div className="mt-6">
        <Piano active={active} setActive={setActive} />
      </div>

      <div className="mt-4 text-sm text-slate-300">
        Active key: <span className="text-slate-100">{active ?? "none"}</span>
      </div>
    </div>
  );
}