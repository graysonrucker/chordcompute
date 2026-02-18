// src/components/piano/WhiteKey.jsx
export default function WhiteKey({ midi, label, active, onClick, widthPx, heightPx }) {
  return (
    <button
      onClick={onClick}
      className={[
        "relative border border-slate-300 text-slate-900",
        "flex items-end justify-center",
        "rounded-b-lg",
        "transition-colors",
        active ? "bg-cyan-300 hover:bg-cyan-200" : "bg-white hover:bg-slate-100",
      ].join(" ")}
      style={{ width: `${widthPx}px`, height: `${heightPx}px` }}
      title={`${label} (MIDI ${midi})`}
    >
      <span className="mb-2 text-sm">{label}</span>
    </button>
  );
}