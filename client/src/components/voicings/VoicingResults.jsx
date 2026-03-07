import { useMemo, useRef, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import VoicingCard from "./VoicingCard";

const ROW_HEIGHT_EST = 320; // safe starting estimate; measuring will correct it
const GAP = 12; // gap-3

export default function VoicingsResults({ results }) {
  if (!results) return null;

  const voicings = useMemo(
    () =>
      (results.voicings || []).filter(
        (v) => Array.isArray(v.notes) && v.notes.length
      ),
    [results.voicings]
  );

  const parentRef = useRef(null);

  const getColumnCount = useCallback(() => {
    const el = parentRef.current;
    const w = el?.clientWidth ?? window.innerWidth;
    return w >= 768 ? 2 : 1;
  }, []);

  const columnCount = getColumnCount();
  const rowCount = Math.ceil(voicings.length / columnCount);

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT_EST,
    overscan: 6,
    measureElement: (el) => el.getBoundingClientRect().height,
  });

  return (
    <div className="mt-6">
      {/* scroll container */}
      <div
        ref={parentRef}
        className="mt-4 h-[86vh] min-h-[400px] w-full overflow-auto"
      >
        {/* spacer element */}
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const rowIndex = virtualRow.index;
            const startIndex = rowIndex * columnCount;

            const items = [];
            for (let c = 0; c < columnCount; c++) {
              const i = startIndex + c;
              if (i >= voicings.length) break;
              items.push({ voicing: voicings[i], index: i });
            }

            return (
              <div
                key={virtualRow.key}
                ref={rowVirtualizer.measureElement}
                data-index={virtualRow.index}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualRow.start}px)`,
                  paddingBottom: `${GAP}px`,
                }}
              >
                <div
                  className={
                    columnCount === 2 ? "grid grid-cols-2" : "grid grid-cols-1"
                  }
                  style={{ gap: `${GAP}px` }}
                >
                  {items.map(({ voicing, index }) => (
                    <VoicingCard
                      key={voicing.pattern ? `${voicing.pattern}-${index}` : index}
                      voicing={voicing}
                      index={index}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}