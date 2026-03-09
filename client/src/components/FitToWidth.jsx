import { useEffect, useMemo, useRef, useState } from "react";

export default function FitToWidth({
  contentWidth,
  children,
  durationMs = 220,
  allowUpscale = false,
  maxScale = 1.6,
}) {
  const outerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      const w = entries?.[0]?.contentRect?.width ?? 0;
      setContainerWidth(w);
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = useMemo(() => {
    const cw = Number(containerWidth);
    const iw = Number(contentWidth);

    // If anything is missing/invalid, render at 1x (never crash)
    if (!Number.isFinite(cw) || !Number.isFinite(iw) || iw <= 0 || cw <= 0) return 1;

    const raw = cw / iw;

    // shrink-to-fit always allowed
    if (raw < 1) return raw;

    // upscale only if allowed
    if (!allowUpscale) return 1;

    // cap upscale
    return Math.min(maxScale, raw);
  }, [containerWidth, contentWidth, allowUpscale, maxScale]);

  // Compute scaled height so the outer wrapper animates its space smoothly
  const scaledHeight = contentWidth > 0 ? undefined : undefined; // let content define

  return (
    <div ref={outerRef} className="w-full overflow-hidden">
      <div
        className="flex justify-center"
        style={{
          transform: `scale(${scale})`,
          transformOrigin: "top center",
          transition: `transform ${durationMs}ms cubic-bezier(0.4, 0, 0.2, 1)`,
        }}
      >
        <div className="inline-block">{children}</div>
      </div>
    </div>
  );
}