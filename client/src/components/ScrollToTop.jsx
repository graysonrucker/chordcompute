import { useEffect, useState } from "react";

export default function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Scroll to top"
      title="Back to top"
      style={{
        position: "fixed",
        bottom: "24px",
        right: "24px",
        zIndex: 90,
        width: "40px",
        height: "40px",
        borderRadius: "10px",
        border: "1px solid rgba(51,65,85,0.6)",
        backgroundColor: "rgba(15,23,42,0.9)",
        backdropFilter: "blur(8px)",
        color: "#94a3b8",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 200ms ease",
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = "#e2e8f0";
        e.currentTarget.style.borderColor = "rgba(71,85,105,0.8)";
        e.currentTarget.style.backgroundColor = "rgba(30,41,59,0.9)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = "#94a3b8";
        e.currentTarget.style.borderColor = "rgba(51,65,85,0.6)";
        e.currentTarget.style.backgroundColor = "rgba(15,23,42,0.9)";
      }}
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
        <polyline points="18 15 12 9 6 15" />
      </svg>
    </button>
  );
}