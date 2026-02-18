export default function KeyboardSideControls({ canAdd, canRemove, onAdd, onRemove }) {
  return (
    <div className="flex flex-col items-center w-14">
      <button
        onClick={onAdd}
        disabled={!canAdd}
        className="w-full px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
      >
        +
      </button>

      {/* Reserve vertical space so layout doesn't jump */}
      <div className="mt-2 w-full h-[36px] flex items-center justify-center">
        {canRemove && (
          <button
            onClick={onRemove}
            className="w-full px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 transition"
          >
            −
          </button>
        )}
      </div>
    </div>
  );
}