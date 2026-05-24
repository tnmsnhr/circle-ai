import React from "react";
import {
  formatExtractedForDisplay,
  extractedToPlainText,
} from "../extraction/formatExtractedDisplay.js";

/**
 * Shows locally extracted text + context (no AI).
 */
export default function ExtractionPanel({
  extracted,
  registerStatus,
  registerError,
  onCopy,
  copied,
}) {
  const { sections } = formatExtractedForDisplay(extracted);

  return (
    <div
      style={{
        marginTop: 10,
        borderTop: "1px solid rgba(0,0,0,12)",
        paddingTop: 8,
        maxHeight: 320,
        overflowY: "auto",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <b style={{ fontSize: 13 }}>Extracted</b>
        {extracted && (
          <button
            type="button"
            onClick={() => onCopy?.(extractedToPlainText(extracted))}
            style={{
              fontSize: 11,
              padding: "3px 8px",
              borderRadius: 6,
              border: "1px solid rgba(0,0,0,0.15)",
              background: "rgba(255,255,255,0.8)",
              cursor: "pointer",
            }}
          >
            {copied ? "Copied" : "Copy all"}
          </button>
        )}
      </div>

      {sections.map((s) => (
        <div key={s.label} style={{ marginTop: 10 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              opacity: 0.55,
              marginBottom: 4,
            }}
          >
            {s.label}
          </div>
          <div
            style={{
              fontSize: 12,
              lineHeight: 1.45,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {s.body}
          </div>
        </div>
      ))}

      {registerStatus === "pending" && (
        <p style={{ margin: "8px 0 0", fontSize: 11, opacity: 0.7 }}>
          <i>Syncing to cloud…</i>
        </p>
      )}
      {registerStatus === "no_session" && (
        <p style={{ margin: "8px 0 0", fontSize: 11, opacity: 0.65 }}>
          <i>Sign in to save this selection to your dashboard.</i>
        </p>
      )}
      {registerStatus === "error" && registerError && (
        <p style={{ margin: "8px 0 0", fontSize: 11, color: "#b91c1c" }}>
          {registerError}
        </p>
      )}
    </div>
  );
}
