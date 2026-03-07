export function WarningBanner({ children }) {
  return (
    <div className="mt-4 flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
      <span className="mt-px select-none text-base leading-none">⚠</span>
      <span>{children}</span>
    </div>
  );
}

export function ErrorBanner({ children }) {
  return (
    <div className="mt-4 flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
      <span className="mt-px select-none text-base leading-none">✕</span>
      <span>{children}</span>
    </div>
  );
}

export function HaltedBanner({ available }) {
  return (
    <div className="mt-4 flex items-start gap-3 rounded-lg border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-sm text-orange-300">
      <span className="mt-px select-none text-base leading-none">⏸</span>
      <div>
        <p className="font-medium">Generation interrupted</p>
        <p className="mt-0.5 text-orange-300/70">
          {available > 0
            ? `${available.toLocaleString()} voicings were saved and are available to browse. `
            : ""}
          This can happen during periods of high server load.
        </p>
      </div>
    </div>
  );
}