// src/components/KeyboardControls.jsx

function SideControls({
  canAdd,
  canRemove,
  onAdd,
  onRemove,
}) {
  return (
    <div className="flex flex-col items-center w-14">
      <button
        onClick={onAdd}
        disabled={!canAdd}
        className="w-full px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
      >
        +
      </button>

      {/* Reserve vertical space even if remove isn't visible */}
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
    <div className="flex items-start gap-6 shrink-0">
      <SideControls
        canAdd={canAddLeft}
        canRemove={leftOctaves > 0}
        onAdd={addLeft}
        onRemove={removeLeft}
      />

      <SideControls
        canAdd={canAddRight}
        canRemove={rightOctaves > 0}
        onAdd={addRight}
        onRemove={removeRight}
      />
    </div>
  );
}