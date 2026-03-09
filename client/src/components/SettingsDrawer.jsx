import { useEffect, useRef, useState } from "react";
import { setInstrument, isPianoLoaded } from "../lib/playback";

const SOUNDS = [
  { id: "synth", label: "Synth" },
  { id: "piano", label: "Piano" },
];

export default function SettingsDrawer({ open, onClose, bottomAsRoot, setBottomAsRoot, sound, setSound }) {
  const drawerRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [pianoLoading, setPianoLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setVisible(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setAnimating(true));
      });
    } else {
      setAnimating(false);
      const timer = setTimeout(() => setVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  async function handleSoundChange(id) {
    setSound(id);
    if (id === "piano" && !isPianoLoaded()) {
      setPianoLoading(true);
      await setInstrument("piano");
      // Poll briefly for load complete
      const check = setInterval(() => {
        if (isPianoLoaded()) {
          setPianoLoading(false);
          clearInterval(check);
        }
      }, 200);
      // Timeout after 15s
      setTimeout(() => { clearInterval(check); setPianoLoading(false); }, 15000);
    } else {
      await setInstrument(id);
    }
  }

  if (!visible) return null;

  const toggleStyle = (active) => ({
    position: "relative",
    width: "44px",
    height: "24px",
    borderRadius: "12px",
    border: "none",
    cursor: "pointer",
    backgroundColor: active ? "#0891b2" : "rgba(51,65,85,0.6)",
    transition: "background-color 200ms ease",
    flexShrink: 0,
  });

  const toggleKnob = (active) => ({
    position: "absolute",
    top: "2px",
    left: active ? "22px" : "2px",
    width: "20px",
    height: "20px",
    borderRadius: "50%",
    backgroundColor: "#fff",
    transition: "left 200ms ease",
    boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
  });

  const soundPill = (active) => ({
    padding: "6px 16px",
    borderRadius: "6px",
    fontSize: "13px",
    fontWeight: active ? 600 : 400,
    color: active ? "#e2e8f0" : "#94a3b8",
    backgroundColor: active ? "rgba(6,182,212,0.25)" : "rgba(30,41,59,0.5)",
    border: active ? "1px solid rgba(6,182,212,0.5)" : "1px solid rgba(51,65,85,0.4)",
    cursor: "pointer",
    transition: "all 120ms ease",
  });

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 9998,
          backgroundColor: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(4px)",
          opacity: animating ? 1 : 0,
          transition: "opacity 300ms ease",
        }}
        aria-hidden="true"
      />

      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        style={{
          position: "fixed", top: 0, right: 0, zIndex: 9999,
          height: "100vh", width: "320px", maxWidth: "85vw",
          display: "flex", flexDirection: "column",
          backgroundColor: "#0f172a",
          borderLeft: "1px solid rgba(30,41,59,0.8)",
          boxShadow: "-8px 0 30px rgba(0,0,0,0.4)",
          transform: animating ? "translateX(0)" : "translateX(100%)",
          transition: "transform 300ms ease",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px",
          borderBottom: "1px solid rgba(30,41,59,0.8)",
        }}>
          <h2 className="text-lg font-semibold text-slate-100 tracking-tight">Settings</h2>
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center w-8 h-8 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors duration-150"
            aria-label="Close settings"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: "24px" }}>

          {/* Sound selector */}
          <div>
            <div style={{ fontSize: "14px", fontWeight: 500, color: "#e2e8f0", marginBottom: "8px" }}>
              Playback sound
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              {SOUNDS.map((s) => (
                <button
                  key={s.id}
                  style={soundPill(sound === s.id)}
                  onClick={() => handleSoundChange(s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>
            {sound === "piano" && pianoLoading && (
              <div style={{ fontSize: "12px", color: "#64748b", marginTop: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                <span
                  style={{
                    display: "inline-block",
                    width: "10px",
                    height: "10px",
                    borderRadius: "50%",
                    border: "2px solid #0891b2",
                    borderTopColor: "transparent",
                    animation: "spin-smooth 0.7s linear infinite",
                  }}
                />
                Loading piano samples…
              </div>
            )}
            {sound === "piano" && !pianoLoading && isPianoLoaded() && (
              <div style={{ fontSize: "12px", color: "#64748b", marginTop: "8px" }}>
                Salamander Grand Piano loaded.
              </div>
            )}
          </div>

          {/* Divider */}
          <div style={{ borderTop: "1px solid rgba(30,41,59,0.6)" }} />

          {/* Bottom as root toggle */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
            <div>
              <div style={{ fontSize: "14px", fontWeight: 500, color: "#e2e8f0" }}>
                Assume bottom note as root
              </div>
              <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px", lineHeight: 1.4 }}>
                When enabled, chord detection only considers the lowest note as the root.
              </div>
            </div>
            <button
              onClick={() => setBottomAsRoot(v => !v)}
              style={toggleStyle(bottomAsRoot)}
              role="switch"
              aria-checked={bottomAsRoot}
              aria-label="Assume bottom note as root"
            >
              <div style={toggleKnob(bottomAsRoot)} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}