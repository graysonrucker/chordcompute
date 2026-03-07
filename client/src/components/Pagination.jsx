/**
 * Pagination
 *
 * Random-access page controls that handle two modes:
 *
 *  • Completed jobs  – shows the full page range; current±2 visible, gaps
 *                      collapsed to "…"
 *
 *  • Streaming jobs  – only pages up to `availablePages` are clickable;
 *                      a pulsing "…" at the end signals more pages are
 *                      still being generated.
 *
 * Props
 *  currentPage    0-based index of the currently visible page
 *  totalPages     number of pages (= availablePages while streaming)
 *  availablePages how many pages can actually be fetched right now
 *  isStreaming    true while the job hasn't finished yet
 *  disabled       grey everything out (initial load / page fetch in flight)
 *  onPageChange   (0-based pageIndex) => void
 */
export default function Pagination({
  currentPage,
  totalPages,
  availablePages,
  isStreaming,
  disabled,
  onPageChange,
}) {
  if (totalPages <= 1 && !isStreaming) return null;

  // Build the ordered list of tokens to render.
  // A token is either a number (0-based page index) or the string "…".
  function buildTokens(current, total) {
    if (total <= 9) {
      // Small range: show every page, no gaps needed.
      return Array.from({ length: total }, (_, i) => i);
    }

    const tokens = new Set();
    tokens.add(0);
    tokens.add(total - 1);

    // Quarter waypoints — only add when they'd be meaningfully far from the
    // current window and the ends, to avoid cluttering small ranges.
    const quarter   = Math.round(total * 0.25);
    const halfway   = Math.round(total * 0.5);
    const threeQ    = Math.round(total * 0.75);

    for (const waypoint of [quarter, halfway, threeQ]) {
      // Only show if it's not already adjacent to first/last page and not
      // within the current window (it'll appear there naturally anyway).
      const nearCurrent = Math.abs(waypoint - current) <= 3;
      const nearEnd     = waypoint <= 1 || waypoint >= total - 2;
      if (!nearCurrent && !nearEnd) tokens.add(waypoint);
    }

    // Window around current page.
    for (let i = Math.max(0, current - 2); i <= Math.min(total - 1, current + 2); i++) {
      tokens.add(i);
    }

    // Sort and inject ellipsis markers where there are gaps > 1.
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
        // Pages beyond availablePages are not yet fetchable during streaming.
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