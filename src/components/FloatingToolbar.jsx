import React, { useCallback, useEffect, useRef, useState } from "react";
import { PRODUCT_MODE_LIST } from "./productModes.js";

const TOOLBAR_POS_KEY = "syncle_toolbar_pos";
const TOOLBAR_SIZE = { width: 168, height: 120 };
const VIEWPORT_MARGIN = 12;

function loadToolbarPosition() {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get({ [TOOLBAR_POS_KEY]: null }, (items) => {
        const pos = items?.[TOOLBAR_POS_KEY];
        if (
          pos &&
          Number.isFinite(pos.x) &&
          Number.isFinite(pos.y)
        ) {
          resolve(pos);
        } else {
          resolve(null);
        }
      });
    } catch {
      resolve(null);
    }
  });
}

function saveToolbarPosition(pos) {
  try {
    chrome.storage.local.set({ [TOOLBAR_POS_KEY]: pos });
  } catch {
    /* ignore */
  }
}

function defaultPosition(viewport) {
  return {
    x: Math.max(
      VIEWPORT_MARGIN,
      viewport.width - TOOLBAR_SIZE.width - 16
    ),
    y: Math.max(
      VIEWPORT_MARGIN,
      viewport.height - TOOLBAR_SIZE.height - 16
    ),
  };
}

function clampPosition(pos, viewport) {
  const maxX = Math.max(
    VIEWPORT_MARGIN,
    viewport.width - TOOLBAR_SIZE.width - VIEWPORT_MARGIN
  );
  const maxY = Math.max(
    VIEWPORT_MARGIN,
    viewport.height - TOOLBAR_SIZE.height - VIEWPORT_MARGIN
  );
  return {
    x: Math.min(Math.max(VIEWPORT_MARGIN, pos.x), maxX),
    y: Math.min(Math.max(VIEWPORT_MARGIN, pos.y), maxY),
  };
}

function ModeIcon({ modeId }) {
  if (modeId === "ai") {
    return (
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 2l1.2 4.2L17 7.4l-3.8 1.2L12 13l-1.2-4.4L7 7.4l3.8-1.2L12 2zm-7 9l1.4 2.4L9 14.8 6.6 13.4 5 15.8l1.4-2.4L5 11l2.6 1.4L9 11l-1.4 2.4L9 15.8 6.6 14.4 5 16.8zm14 0l-1.4 2.4L15 14.8l2.4-1.4L19 15.8l-1.4-2.4L19 11l-2.6 1.4L15 11l1.4 2.4L15 15.8l2.4-1.4 2.6 1.4zM12 16l2.8 4.8L12 22l-2.8-1.2L12 16z"
        />
      </svg>
    );
  }
  if (modeId === "clips") {
    return (
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path
          fill="currentColor"
          d="M8 3a3 3 0 0 0-3 3v13l5-3 5 3V6a3 3 0 0 0-3-3H8zm0 2h1a1 1 0 0 1 1 1v11.2l-3-1.8V6a1 1 0 0 0-1-1zm8-1a3 3 0 0 1 3 3v14.2l-5-3-5 3V7a3 3 0 0 1 3-3h4z"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        fill="currentColor"
        d="M6 2h9l5 5v15a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm8 1.5V8h4.5L14 3.5zM8 11h8v2H8v-2zm0 4h8v2H8v-2zm0 4h5v2H8v-2z"
      />
    </svg>
  );
}

export default function FloatingToolbar({
  productMode,
  onProductModeChange,
  drawingEnabled,
  hotkeyReady,
  onUndo,
  onClear,
  viewport,
}) {
  const toolbarRef = useRef(null);
  const dragRef = useRef(null);
  const [position, setPosition] = useState(null);

  useEffect(() => {
    let cancelled = false;
    loadToolbarPosition().then((saved) => {
      if (cancelled) return;
      setPosition(
        clampPosition(saved ?? defaultPosition(viewport), viewport)
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!position) return;
    setPosition((prev) =>
      prev ? clampPosition(prev, viewport) : defaultPosition(viewport)
    );
  }, [viewport.width, viewport.height]);

  const onDragPointerDown = useCallback(
    (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();

      const startX = e.clientX;
      const startY = e.clientY;
      const origin = position ?? defaultPosition(viewport);

      dragRef.current = { startX, startY, origin };

      const onMove = (ev) => {
        const drag = dragRef.current;
        if (!drag) return;
        const next = clampPosition(
          {
            x: drag.origin.x + (ev.clientX - drag.startX),
            y: drag.origin.y + (ev.clientY - drag.startY),
          },
          viewport
        );
        setPosition(next);
      };

      const onUp = () => {
        dragRef.current = null;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        setPosition((prev) => {
          if (prev) saveToolbarPosition(prev);
          return prev;
        });
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [position, viewport]
  );

  if (!position) return null;

  const activeMeta = PRODUCT_MODE_LIST.find((m) => m.id === productMode);

  return (
    <div
      ref={toolbarRef}
      className="syncle-floating-toolbar"
      style={{ left: position.x, top: position.y }}
      role="toolbar"
      aria-label="Syncle tools"
    >
      <button
        type="button"
        className="syncle-floating-toolbar__drag"
        aria-label="Drag toolbar"
        title="Drag to reposition"
        onPointerDown={onDragPointerDown}
      >
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <circle cx="5" cy="4" r="1.2" fill="currentColor" />
          <circle cx="11" cy="4" r="1.2" fill="currentColor" />
          <circle cx="5" cy="8" r="1.2" fill="currentColor" />
          <circle cx="11" cy="8" r="1.2" fill="currentColor" />
          <circle cx="5" cy="12" r="1.2" fill="currentColor" />
          <circle cx="11" cy="12" r="1.2" fill="currentColor" />
        </svg>
      </button>

      <div className="syncle-floating-toolbar__modes">
        {PRODUCT_MODE_LIST.map((mode) => {
          const active = productMode === mode.id;
          return (
            <button
              key={mode.id}
              type="button"
              className={`syncle-mode-btn${active ? " syncle-mode-btn--active" : ""}`}
              aria-label={mode.label}
              aria-pressed={active}
              title={mode.title}
              onClick={() => onProductModeChange(mode.id)}
            >
              <ModeIcon modeId={mode.id} />
              <span className="syncle-mode-btn__label">{mode.shortLabel}</span>
            </button>
          );
        })}
      </div>

      <div className="syncle-floating-toolbar__footer">
        {productMode === "ai" ? (
          <span className="syncle-floating-toolbar__hint">
            Hold <b>⌘</b>/<b>Ctrl</b> + drag
            {!drawingEnabled
              ? " (off)"
              : hotkeyReady
                ? " · ready"
                : ""}
          </span>
        ) : (
          <span className="syncle-floating-toolbar__hint syncle-floating-toolbar__hint--muted">
            {activeMeta?.label} — coming soon
          </span>
        )}
        <div className="syncle-floating-toolbar__actions">
          <button
            type="button"
            className="syncle-icon-btn"
            aria-label="Undo last selection"
            title="Undo"
            onClick={onUndo}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path
                fill="currentColor"
                d="M12.5 8c-2.65 0-5.05 1.28-6.55 3.25L3 8v8h8l-2.48-2.48A6.98 6.98 0 0 1 12.5 10c3.04 0 5.5 2.46 5.5 5.5h2C20 11.02 16.73 8 12.5 8z"
              />
            </svg>
          </button>
          <button
            type="button"
            className="syncle-icon-btn"
            aria-label="Clear all selections"
            title="Clear"
            onClick={onClear}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path
                fill="currentColor"
                d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
