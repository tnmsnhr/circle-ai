import React, { useLayoutEffect, useRef } from "react";
import "./popupBubble.css";

const PopupBubble = ({
  x,
  y,
  centroidX,
  centroidY,
  compact,
  morph,
  accentColor = "#22c55e",
  fillColor = "rgba(34, 197, 94, 0.2)",
  onClose,
  onExpand,
  children,
}) => {
  const rootRef = useRef(null);
  const cx = centroidX ?? x;
  const cy = centroidY ?? y;

  // Compact chips track the selection instantly (no CSS transition on position).
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    if (morph) {
      el.style.removeProperty("left");
      el.style.removeProperty("top");
      el.style.removeProperty("transform");
      return;
    }

    if (compact) {
      el.style.left = `${cx}px`;
      el.style.top = `${cy}px`;
      el.style.transform = "translate(-50%, -50%)";
    } else {
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.style.transform = "translate(0, 0)";
    }
  }, [compact, morph, x, y, cx, cy]);

  const classNames = [
    "popup-bubble",
    compact && "popup-bubble--compact",
    morph && "popup-bubble--morph",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      ref={rootRef}
      className={classNames}
      style={{
        "--bubble-x": `${x}px`,
        "--bubble-y": `${y}px`,
        "--chip-x": `${cx}px`,
        "--chip-y": `${cy}px`,
        "--accent": accentColor,
        "--fill": fillColor,
      }}
    >
      <div className="popup-bubble__inner">
        {!compact && (
          <div className="popup-bubble__header">
            <strong>Selection</strong>
            <button
              type="button"
              className="popup-bubble__close"
              onClick={onClose}
              aria-label="Close"
              title="Close"
            >
              ×
            </button>
          </div>
        )}

        <div className="popup-bubble__content">{children}</div>

        {!compact && (
          <div className="popup-bubble__actions">
            <button
              type="button"
              className="popup-bubble__btn popup-bubble__btn--primary"
              onClick={() => alert("Saved")}
            >
              Save
            </button>
            <button
              type="button"
              className="popup-bubble__btn"
              onClick={() => alert("Deleted")}
            >
              Delete
            </button>
          </div>
        )}

        {compact && (
          <button
            type="button"
            className="popup-bubble__expand-hit"
            onClick={onExpand}
            aria-label="Expand selection chat"
            title="Expand selection"
          />
        )}
      </div>
    </div>
  );
};

export default PopupBubble;
