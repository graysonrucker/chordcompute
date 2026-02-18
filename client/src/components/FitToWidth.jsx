import { useLayoutEffect, useRef, useState } from "react";

export default function FitToWidth({ contentWidth, children }) {
  const wrapRef = useRef(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const ro = new ResizeObserver(([entry]) => {
      const available = entry.contentRect.width;
      const next = Math.min(1, available / contentWidth);
      setScale(next);
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, [contentWidth]);

  const scaledWidth = contentWidth * scale;

  return (
    <div ref={wrapRef} className="w-full">
      {/* This outer box reserves the SCALED width so centering is correct */}
      <div className="mx-auto" style={{ width: scaledWidth }}>
        {/* This inner box is the "natural size" element that gets scaled */}
        <div
          style={{
            width: contentWidth,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}