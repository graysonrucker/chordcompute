// src/components/FitToWidth.jsx
import { useEffect, useMemo, useRef, useState } from "react";

export default function FitToWidth({
  contentWidth,
  children,
  className = "",
  durationMs = 220,
}) {
  const outerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    if (!outerRef.current) return;

    const el = outerRef.current;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width ?? 0;
      setContainerWidth(w);
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = useMemo(() => {
    if (!containerWidth || !contentWidth) return 1;
    return Math.min(1, containerWidth / contentWidth);
  }, [containerWidth, contentWidth]);

  return (
    <div
      ref={outerRef}
      className={`w-full overflow-hidden ${className}`}
      style={{ willChange: "transform" }}
    >
      <div
        className="flex justify-center"
        style={{
          transform: `scale(${scale})`,
          transformOrigin: "top center",
          transition: `transform ${durationMs}ms ease`,
        }}
      >
        {/* This ensures the child has a real intrinsic width to scale from */}
        <div className="inline-block">{children}</div>
      </div>
    </div>
  );
}