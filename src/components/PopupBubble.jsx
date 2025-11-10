import React from "react";

export default function PopupBubble({ x, y, onClose, children }) {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        zIndex: 2147483647,
        pointerEvents: "auto",            // ✅ clickable
        background: "white",
        border: "1px solid rgba(0,0,0,0.12)",
        borderRadius: 10,
        boxShadow:
          "0 6px 16px rgba(0,0,0,0.2), 0 1px 3px rgba(0,0,0,0.08)",
        padding: 10,
        minWidth: 220,
        maxWidth: 320,
        color: "#111",
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
