export default function KeyboardControls({
  leftOctaves,
  rightOctaves,
  canAddLeft,
  canAddRight,
  addLeft,
  removeLeft,
  addRight,
  removeRight,
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex flex-col items-center">
        <button
          onClick={addLeft}
          disabled={!canAddLeft}
          className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40"
        >
          +
        </button>
        {leftOctaves > 0 && (
          <button
            onClick={removeLeft}
            className="mt-2 px-3 py-1 rounded bg-slate-800 hover:bg-slate-700"
          >
            −
          </button>
        )}
      </div>

      <div className="flex flex-col items-center">
        <button
          onClick={addRight}
          disabled={!canAddRight}
          className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40"
        >
          +
        </button>
        {rightOctaves > 0 && (
          <button
            onClick={removeRight}
            className="mt-2 px-3 py-1 rounded bg-slate-800 hover:bg-slate-700"
          >
            −
          </button>
        )}
      </div>
    </div>
  );
}