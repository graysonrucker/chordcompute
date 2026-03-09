import { useEffect, useRef, useState } from "react";

export default function SettingsDrawer({ open, onClose }) {
  const drawerRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);

  /* Manage mount/unmount with animation */
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

  /* close on Escape */
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!visible) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9998,
          backgroundColor: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(4px)",
          opacity: animating ? 1 : 0,
          transition: "opacity 300ms ease",
        }}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          zIndex: 9999,
          height: "100vh",
          width: "320px",
          maxWidth: "85vw",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#0f172a",
          borderLeft: "1px solid rgba(30,41,59,0.8)",
          boxShadow: "-8px 0 30px rgba(0,0,0,0.4)",
          transform: animating ? "translateX(0)" : "translateX(100%)",
          transition: "transform 300ms ease",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid rgba(30,41,59,0.8)",
          }}
        >
          <h2 className="text-lg font-semibold text-slate-100 tracking-tight">
            Settings
          </h2>
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center w-8 h-8 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors duration-150"
            aria-label="Close settings"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body — future settings go here */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
          <p className="text-sm text-slate-500">
            Settings will appear here as new features are added.
          </p>
        </div>
      </div>
    </>
  );
}