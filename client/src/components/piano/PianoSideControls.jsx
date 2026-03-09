export default function KeyboardSideControls({ canAdd, canRemove, onAdd, onRemove }) {
  const btnClass = [
    "w-9 h-9 flex items-center justify-center rounded-lg text-sm font-semibold",
    "transition-all duration-150 ease-out",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400",
  ].join(" ");

  return (
    <div className="flex flex-col items-center gap-2 pt-1">
      <button
        onClick={onAdd}
        disabled={!canAdd}
        className={[
          btnClass,
          canAdd
            ? "bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/50 hover:border-slate-600 active:scale-95"
            : "bg-slate-800/40 text-slate-600 cursor-not-allowed border border-transparent",
        ].join(" ")}
        title="Add octave"
      >
        +
      </button>

      <div className="h-9 flex items-center justify-center">
        {canRemove && (
          <button
            onClick={onRemove}
            className={[
              btnClass,
              "bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/50 hover:border-slate-600 active:scale-95",
            ].join(" ")}
            title="Remove octave"
          >
            −
          </button>
        )}
      </div>
    </div>
  );
}