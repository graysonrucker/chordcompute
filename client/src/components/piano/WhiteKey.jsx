export default function WhiteKey({ midi, label, active, onMouseDown, onMouseEnter, widthPx, heightPx }) {
  return (
    <button
      onMouseDown={(e) => { e.preventDefault(); onMouseDown(); }}
      onMouseEnter={onMouseEnter}
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