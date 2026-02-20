export default function BlackKey({ midi, label, active, onClick, leftPx, widthPx, heightPx }) {
  return (
    <button
      onClick={onClick}
      className={[
        "pointer-events-auto absolute",
        "border border-black/60 text-slate-100",
        "rounded-b-lg shadow",
        "transition-colors",
        active ? "bg-cyan-300 hover:bg-cyan-200" : "bg-slate-900 hover:bg-slate-800",
      ].join(" ")}
      style={{
        left: `${leftPx}px`,
        width: `${widthPx}px`,
        height: `${heightPx}px`,
      }}
      title={`${label} (MIDI ${midi})`}
    >
      <span className="sr-only">{label}</span>
    </button>
  );
}