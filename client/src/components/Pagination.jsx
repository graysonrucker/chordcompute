export default function Pagination({
  currentPage,
  totalPages,
  availablePages,
  isStreaming,
  disabled,
  onPageChange,
}) {
  if (totalPages <= 1 && !isStreaming) return null;

  // Build the ordered list of tokens to render
  function buildTokens(current, total) {
    if (total <= 9) {
      // Small range: show every page, no gaps needed
      return Array.from({ length: total }, (_, i) => i);
    }

    const tokens = new Set();
    tokens.add(0);
    tokens.add(total - 1);

    // Window around current page.
    for (let i = Math.max(0, current - 2); i <= Math.min(total - 1, current + 2); i++) {
      tokens.add(i);
    }

    // Sort and inject ellipsis markers where there are gaps > 1
    const sorted = [...tokens].sort((a, b) => a - b);
    const result = [];
    let prev = -1;
    for (const p of sorted) {
      if (prev !== -1 && p > prev + 1) result.push("…");
      result.push(p);
      prev = p;
    }
    return result;
  }

  const tokens = buildTokens(currentPage, totalPages);

  const btnBase =
    "relative inline-flex items-center justify-center min-w-[2rem] h-8 px-2 rounded text-sm font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";

  const btnActive =
    "bg-blue-600 text-white shadow-inner shadow-blue-900/40";

  const btnIdle =
    "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-slate-100";

  const btnDisabled =
    "opacity-40 cursor-not-allowed";

  return (
    <nav
      aria-label="Page navigation"
      className="flex flex-wrap items-center gap-1"
    >
      {/* ◂ Prev */}
      <button
        className={`${btnBase} ${currentPage === 0 || disabled ? btnDisabled : btnIdle}`}
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 0 || disabled}
        aria-label="Previous page"
      >
        ◂
      </button>

      {/* Numbered tokens */}
      {tokens.map((token, idx) => {
        if (token === "…") {
          return (
            <span
              key={`ellipsis-${idx}`}
              className="inline-flex items-center justify-center min-w-[1.5rem] h-8 text-slate-500 text-sm select-none"
              aria-hidden="true"
            >
              …
            </span>
          );
        }

        const page = token;
        const isCurrent = page === currentPage;
        // Pages beyond availablePages are not yet fetchable during streaming
        const unavailable = page >= availablePages;
        const isDisabled = disabled || unavailable;

        return (
          <button
            key={page}
            onClick={() => !isDisabled && onPageChange(page)}
            disabled={isDisabled}
            aria-current={isCurrent ? "page" : undefined}
            aria-label={`Page ${page + 1}`}
            className={[
              btnBase,
              isCurrent ? btnActive : btnIdle,
              isDisabled ? btnDisabled : "",
            ].join(" ")}
          >
            {page + 1}
          </button>
        );
      })}

      {/* Streaming indicator — pulsing "…" after last available page */}
      {isStreaming && (
        <span
          className="inline-flex items-center justify-center min-w-[1.5rem] h-8 text-slate-400 text-sm animate-pulse select-none"
          title="More pages being generated…"
          aria-label="More pages loading"
        >
          …
        </span>
      )}

      {/* ▸ Next */}
      <button
        className={`${btnBase} ${currentPage >= availablePages - 1 || disabled ? btnDisabled : btnIdle}`}
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= availablePages - 1 || disabled}
        aria-label="Next page"
      >
        ▸
      </button>
    </nav>
  );
}
