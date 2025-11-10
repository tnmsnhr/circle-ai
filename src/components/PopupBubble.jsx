import React from "react"
import "./popupBubble.css"

const PopupBubble = ({ x, y, onClose, children }) => {
    const isDark = false
    // const isDark = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
  return (
    <div
    className="popupContainer"
      style={{
        position: "absolute",
        left: x,
        top: y,
        zIndex: 2147483647,
        pointerEvents: "auto",          
         background: isDark ? "rgba(22,22,22,0.55)" : "rgba(255,255,255,0.55)",
        backdropFilter: "blur(16px) saturate(160%) contrast(105%)",
        WebkitBackdropFilter: "blur(16px) saturate(160%) contrast(105%)",
        border: isDark
        ? "1px solid rgba(255,255,255,0.12)"
        : "1px solid rgba(0,0,0,0.10)",
      borderRadius: 12,
      boxShadow: isDark
        ? "0 8px 30px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)"
        : "0 8px 30px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.6)",
        padding: 10,
        minWidth: 220,
        maxWidth: 320,
        color: isDark ? "#f5f5f5" : "#111",
        font: "13px/1.4 system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <strong style={{ fontSize: 13 }}>Selection</strong>
        <button
          onClick={onClose}
          style={{
            border: "none",
            background: "transparent",
            cursor: "pointer",
            fontSize: 16,
            lineHeight: 1
          }}
          aria-label="Close"
          title="Close"
        >
          ×
        </button>
      </div>

      <div>{children}</div>

      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid rgba(0,0,0,0.15)",
            background: "#111",
            color: "white",
            cursor: "pointer"
          }}
          onClick={() => alert("Saved")}
        >
          Save
        </button>
        <button
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid rgba(0,0,0,0.15)",
            background: "#f3f4f6",
            cursor: "pointer"
          }}
          onClick={() => alert("Deleted")}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

export default PopupBubble
