const TABS = [
  { id: "generate", label: "Generate" },
  { id: "info",     label: "Info" },
];

export default function NavBar({ activeTab, onTabChange, onSettingsOpen }) {
  return (
    <nav
      style={{
        display: "flex",
        alignItems: "center",
        gap: "24px",
        padding: "0 16px",
        height: "56px",
        borderBottom: "1px solid rgba(30,41,59,0.6)",
        backgroundColor: "rgba(2,6,23,0.8)",
        backdropFilter: "blur(12px)",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}
    >
      {/* Logo */}
      <span
        style={{
          fontSize: "20px",
          fontWeight: 700,
          letterSpacing: "-0.03em",
          color: "#e2e8f0",
          marginRight: "8px",
          userSelect: "none",
          whiteSpace: "nowrap",
        }}
      >
        Chord
        <span style={{ color: "#22d3ee" }}>Compute</span>
      </span>

      {/* Tabs */}
      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              style={{
                padding: "6px 14px",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: isActive ? 600 : 400,
                color: isActive ? "#e2e8f0" : "#94a3b8",
                backgroundColor: isActive ? "rgba(30,41,59,0.7)" : "transparent",
                border: "none",
                cursor: "pointer",
                transition: "all 150ms ease",
                letterSpacing: "0.01em",
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = "#cbd5e1";
                  e.currentTarget.style.backgroundColor = "rgba(30,41,59,0.4)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = "#94a3b8";
                  e.currentTarget.style.backgroundColor = "transparent";
                }
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Settings gear */}
      <button
        onClick={onSettingsOpen}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: "34px",
          height: "34px",
          borderRadius: "8px",
          border: "1px solid rgba(51,65,85,0.6)",
          backgroundColor: "transparent",
          color: "#94a3b8",
          cursor: "pointer",
          transition: "all 150ms ease",
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = "#e2e8f0";
          e.currentTarget.style.backgroundColor = "rgba(30,41,59,0.6)";
          e.currentTarget.style.borderColor = "rgba(71,85,105,0.8)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = "#94a3b8";
          e.currentTarget.style.backgroundColor = "transparent";
          e.currentTarget.style.borderColor = "rgba(51,65,85,0.6)";
        }}
        aria-label="Open settings"
        title="Settings"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
    </nav>
  );
}