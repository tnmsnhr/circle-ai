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
  onMinimize,
  onDismiss,
  onBringToFront,
  onExpand,
  zIndex = 2147483647,
  children,
}) => {
  const rootRef = useRef(null);
  const cx = centroidX ?? x;
  const cy = centroidY ?? y;

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
        "--bubble-z": String(zIndex),
      }}
    >
      <div className="popup-bubble__inner">
        {!compact && (
          <div className="popup-bubble__header">
            <div className="popup-bubble__traffic" aria-label="Window controls">
              <button
                type="button"
                className="popup-bubble__dot popup-bubble__dot--dismiss"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDismiss?.();
                }}
                aria-label="Cancel selection"
                title="Cancel — remove selection and chat"
              >
                <span className="popup-bubble__dot-icon" aria-hidden="true">
                  <svg viewBox="0 0 12 12" aria-hidden="true">
                    <path
                      d="M2.75 2.75l6.5 6.5M9.25 2.75l-6.5 6.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              </button>
              <button
                type="button"
                className="popup-bubble__dot popup-bubble__dot--minimize"
                onClick={onMinimize}
                aria-label="Minimize"
                title="Minimize — collapse to dot"
              >
                <span className="popup-bubble__dot-icon" aria-hidden="true">
                  <svg viewBox="0 0 12 12" aria-hidden="true">
                    <path
                      d="M2.5 6h7"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              </button>
              <button
                type="button"
                className="popup-bubble__dot popup-bubble__dot--front"
                onClick={onBringToFront}
                aria-label="Bring to front"
                title="Bring to front"
              >
                <span className="popup-bubble__dot-icon" aria-hidden="true">
                  <svg viewBox="0 0 12 12" aria-hidden="true">
                    <path
                      d="M6 2.75v6.5M2.75 6h6.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              </button>
            </div>
            <strong className="popup-bubble__title">Selection</strong>
          </div>
        )}

        <div className="popup-bubble__content">{children}</div>

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
