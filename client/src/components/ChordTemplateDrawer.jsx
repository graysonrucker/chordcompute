import { useEffect, useRef, useState, useMemo } from "react";
import { buildChordMidi, buildChordName, SHARP_NAMES, FLAT_NAMES } from "../lib/chordTemplate";

/* ── Style helpers ──────────────────────────────────────── */

const pill = (active) => ({
  padding: "5px 12px",
  borderRadius: "6px",
  fontSize: "13px",
  fontWeight: active ? 600 : 400,
  color: active ? "#e2e8f0" : "#94a3b8",
  backgroundColor: active ? "rgba(6,182,212,0.25)" : "rgba(30,41,59,0.5)",
  border: active ? "1px solid rgba(6,182,212,0.5)" : "1px solid rgba(51,65,85,0.4)",
  cursor: "pointer",
  transition: "all 120ms ease",
  textAlign: "center",
  minWidth: 0,
});

const pillDisabled = {
  ...pill(false),
  opacity: 0.35,
  cursor: "not-allowed",
};

const sectionLabel = {
  fontSize: "11px",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "#64748b",
  marginBottom: "8px",
};

const grid = (cols) => ({
  display: "grid",
  gridTemplateColumns: `repeat(${cols}, 1fr)`,
  gap: "6px",
});

/* ── Toggle helper ──────────────────────────────────────── */
function toggleIn(arr, val) {
  return arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];
}

/* ── Main component ─────────────────────────────────────── */

const QUALITIES   = ["major","minor","dim","aug","sus2","sus4"];
const QUAL_LABELS = { major:"Major", minor:"Minor", dim:"Dim", aug:"Aug", sus2:"Sus2", sus4:"Sus4" };
const SEVENTHS    = ["none","maj7","dom7","dim7"];
const SEV_LABELS  = { none:"None", maj7:"Maj7", dom7:"7", dim7:"Dim7" };
const EXTENSIONS  = ["9","11","13"];
const ALTERATIONS = ["b5","#5","b9","#9","#11","b13"];
const ALT_LABELS  = { b5:"♭5", "#5":"♯5", b9:"♭9", "#9":"♯9", "#11":"♯11", b13:"♭13" };
const OMISSIONS   = ["no3","no5"];

export default function ChordTemplateDrawer({ open, onClose, onApply, preferSharps }) {
  const drawerRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);

  const [rootPc, setRootPc] = useState(0);         // C
  const [quality, setQuality] = useState("major");
  const [seventh, setSeventh] = useState("none");
  const [extensions, setExtensions] = useState([]);
  const [alterations, setAlterations] = useState([]);
  const [omissions, setOmissions] = useState([]);

  const names = preferSharps ? SHARP_NAMES : FLAT_NAMES;
  const has7th = seventh !== "none";

  /* Build preview of what will be applied */
  const previewNotes = useMemo(
    () => buildChordMidi(rootPc, quality, seventh, extensions, alterations, omissions),
    [rootPc, quality, seventh, extensions, alterations, omissions]
  );

  /* Animation mount/unmount */
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

  /* Escape to close */
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  /* When 7th is cleared, also clear extensions */
  function handleSetSeventh(val) {
    setSeventh(val);
    if (val === "none") setExtensions([]);
  }

  if (!visible) return null;

  return (
    <>
      {/* Backdrop */}
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

      {/* Drawer */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Chord template"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed", top: 0, right: 0, zIndex: 9999,
          height: "100vh", width: "340px", maxWidth: "90vw",
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
          <h2 className="text-lg font-semibold text-slate-100 tracking-tight">
            Chord Template
          </h2>
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center w-8 h-8 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors duration-150"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: "20px" }}>

          {/* Root */}
          <div>
            <div style={sectionLabel}>Root</div>
            <div style={grid(4)}>
              {Array.from({ length: 12 }, (_, i) => (
                <button key={i} style={pill(rootPc === i)} onClick={() => setRootPc(i)}>
                  {names[i]}
                </button>
              ))}
            </div>
          </div>

          {/* Quality */}
          <div>
            <div style={sectionLabel}>Quality</div>
            <div style={grid(3)}>
              {QUALITIES.map((q) => (
                <button key={q} style={pill(quality === q)} onClick={() => setQuality(q)}>
                  {QUAL_LABELS[q]}
                </button>
              ))}
            </div>
          </div>

          {/* Seventh */}
          <div>
            <div style={sectionLabel}>Seventh</div>
            <div style={grid(4)}>
              {SEVENTHS.map((s) => (
                <button key={s} style={pill(seventh === s)} onClick={() => handleSetSeventh(s)}>
                  {SEV_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Extensions */}
          <div>
            <div style={sectionLabel}>Extensions</div>
            <div style={grid(3)}>
              {EXTENSIONS.map((e) => {
                const active = extensions.includes(e);
                const disabled = !has7th;
                return (
                  <button
                    key={e}
                    style={disabled ? pillDisabled : pill(active)}
                    onClick={() => !disabled && setExtensions(toggleIn(extensions, e))}
                    disabled={disabled}
                    title={disabled ? "Select a 7th first" : ""}
                  >
                    {e}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Alterations */}
          <div>
            <div style={sectionLabel}>Alterations</div>
            <div style={grid(3)}>
              {ALTERATIONS.map((a) => (
                <button
                  key={a}
                  style={pill(alterations.includes(a))}
                  onClick={() => setAlterations(toggleIn(alterations, a))}
                >
                  {ALT_LABELS[a]}
                </button>
              ))}
            </div>
          </div>

          {/* Omissions */}
          <div>
            <div style={sectionLabel}>Omissions</div>
            <div style={grid(3)}>
              {OMISSIONS.map((o) => (
                <button key={o} style={pill(omissions.includes(o))} onClick={() => setOmissions(toggleIn(omissions, o))}>
                  {o}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div style={{
            padding: "10px 14px", borderRadius: "8px",
            backgroundColor: "rgba(30,41,59,0.4)",
            border: "1px solid rgba(51,65,85,0.3)",
          }}>
            <div style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#64748b", marginBottom: "4px" }}>
              Preview
            </div>
            <span style={{ fontSize: "15px", fontWeight: 500, color: "#e2e8f0", fontFamily: "monospace" }}>
              {previewNotes.map((m) => {
                const pc = ((m % 12) + 12) % 12;
                const oct = Math.floor(m / 12) - 1;
                return `${names[pc]}${oct}`;
              }).join("  ")}
            </span>
          </div>
        </div>

        {/* Footer / Apply */}
        <div style={{
          padding: "16px 20px",
          borderTop: "1px solid rgba(30,41,59,0.8)",
        }}>
          <button
            type="button"
            onClick={() => {
              if (previewNotes.length > 0) {
                const name = buildChordName(rootPc, quality, seventh, extensions, alterations, omissions, names);
                onApply([...previewNotes], name);
              }
            }}
            disabled={previewNotes.length === 0}
            style={{
              width: "100%",
              padding: "10px 0",
              borderRadius: "8px",
              border: "none",
              fontSize: "14px",
              fontWeight: 600,
              cursor: previewNotes.length === 0 ? "not-allowed" : "pointer",
              color: previewNotes.length === 0 ? "#475569" : "#fff",
              background: previewNotes.length === 0
                ? "rgba(30,41,59,0.5)"
                : "linear-gradient(to right, #0891b2, #06b6d4)",
              transition: "all 150ms ease",
            }}
          >
            Apply to Piano
          </button>
        </div>
      </div>
    </>
  );
}