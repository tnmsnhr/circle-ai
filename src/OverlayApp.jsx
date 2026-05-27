// OverlayLasso.jsx
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import PopupBubble from "./components/PopupBubble.jsx";
import {
  uid,
  bboxOf,
  pickAnchor,
  getViewportSize,
  clientPointsFromAnchor,
  clientPointFromAnchor,
  offsetsFromClientPoints,
  getSelectionCentroid,
  attachScrollBubbleController,
  BUBBLE_MORPH_MS,
  loadSettings,
  isDrawingEnabled,
  isAutoCollapseEnabled,
  getLassoTheme,
  DEFAULT_LASSO_THEME_ID,
} from "./utils";
import { runSelectionExtraction } from "./extraction/runExtraction.js";
import { ensureContextRegistered } from "./api/registerContext.js";
import { sendChatMessage } from "./api/chatClient.js";
import { isSignedIn } from "./auth/session.js";
import { CLOUD_SYNC_ENABLED } from "./config/features.js";
import FloatingToolbar from "./components/FloatingToolbar.jsx";
import {
  PRODUCT_MODES,
  isAiProductMode,
} from "./components/productModes.js";

const isHotkey = (e) => e.metaKey || e.ctrlKey;
const AUTO_CHAT_MESSAGE = "__syncle_explain_selection__";

export default function OverlayApp({ toolbarMount }) {
  const [hotkeyReady, setHotkeyReady] = useState(false);
  const [drawingEnabled, setDrawingEnabled] = useState(true);
  const [viewport, setViewport] = useState(getViewportSize());
  const [, setFrame] = useState(0);

  const drawingEnabledRef = useRef(true);
  const autoCollapseRef = useRef(true);
  const isDrawingRef = useRef(false);
  const lassoThemeRef = useRef(getLassoTheme(DEFAULT_LASSO_THEME_ID));
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;

  const [productMode, setProductMode] = useState(PRODUCT_MODES.AI);
  const productModeRef = useRef(PRODUCT_MODES.AI);
  productModeRef.current = productMode;

  const [signedIn, setSignedIn] = useState(false);
  const [popups, setPopups] = useState([]);
  const [popupsCompact, setPopupsCompact] = useState(false);
  const [bubbleMorph, setBubbleMorph] = useState(null);
  const [morphPopupId, setMorphPopupId] = useState(null);
  const [expandedPopupIds, setExpandedPopupIds] = useState(() => new Set());
  const popupsCompactRef = useRef(false);
  const expandedPopupIdsRef = useRef(new Set());
  const bubbleMorphRef = useRef(null);
  const morphTimerRef = useRef(null);
  const resetScrollAccumulatedRef = useRef(() => {});
  popupsCompactRef.current = popupsCompact;
  expandedPopupIdsRef.current = expandedPopupIds;
  bubbleMorphRef.current = bubbleMorph;

  const addExpandedPopup = (id) => {
    setExpandedPopupIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const clearExpandedPopups = () => setExpandedPopupIds(new Set());

  const popupsCountRef = useRef(0);
  popupsCountRef.current = popups.length;

  const liveCanvasRef = useRef(null);
  const inkCanvasRef = useRef(null);
  const pointsRef = useRef([]);
  const polysRef = useRef([]);
  const anchorsRef = useRef(new Map());

  const liveCtx = () => liveCanvasRef.current?.getContext("2d");
  const inkCtx = () => inkCanvasRef.current?.getContext("2d");

  const getAnchor = (id) => {
    const a = anchorsRef.current.get(id);
    return a?.isConnected ? a : null;
  };

  const bump = () => setFrame((n) => n + 1);

  const redrawInk = () => {
    const ctx = inkCtx();
    if (!ctx) return;
    const { width, height } = viewportRef.current;
    ctx.clearRect(0, 0, width, height);
    const colors = lassoThemeRef.current;
    ctx.lineWidth = 2;
    ctx.strokeStyle = colors.border;
    ctx.fillStyle = colors.fill;

    for (const poly of polysRef.current) {
      const anchor = getAnchor(poly.id) || poly.anchor;
      const clientPts = clientPointsFromAnchor(
        anchor,
        poly.offsets,
        poly.pts
      );
      if (!clientPts || clientPts.length < 2) continue;

      ctx.beginPath();
      ctx.moveTo(clientPts[0].x, clientPts[0].y);
      for (let i = 1; i < clientPts.length; i++) {
        ctx.lineTo(clientPts[i].x, clientPts[i].y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  };

  const drawLive = () => {
    const ctx = liveCtx();
    if (!ctx) return;
    const { width, height } = viewportRef.current;
    ctx.clearRect(0, 0, width, height);
    const pts = pointsRef.current;
    if (pts.length < 1) return;

    ctx.beginPath();
    ctx.moveTo(pts[0].clientX, pts[0].clientY);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].clientX, pts[i].clientY);
    }
    if (pts.length > 1) {
      ctx.lineTo(pts[0].clientX, pts[0].clientY);
    }

    ctx.strokeStyle = lassoThemeRef.current.border;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.stroke();
    ctx.setLineDash([]);
  };

  const resizeCanvases = () => {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const { width, height } = getViewportSize();
    setViewport({ width, height });

    for (const c of [liveCanvasRef.current, inkCanvasRef.current]) {
      if (!c) continue;
      c.style.width = `${width}px`;
      c.style.height = `${height}px`;
      c.width = Math.ceil(width * dpr);
      c.height = Math.ceil(height * dpr);
      const ctx = c.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
    }

    liveCtx()?.clearRect(0, 0, width, height);
    redrawInk();
  };

  const syncFrame = () => {
    redrawInk();
    // Keep popups/chips aligned with anchors on scroll (no transition while compact).
    if (popupsCountRef.current > 0) {
      bump();
    }
  };

  const startMorph = (phase, afterFrame) => {
    if (morphTimerRef.current) clearTimeout(morphTimerRef.current);
    setBubbleMorph(phase);
    requestAnimationFrame(() => {
      requestAnimationFrame(afterFrame);
    });
    morphTimerRef.current = setTimeout(() => {
      setBubbleMorph(null);
      morphTimerRef.current = null;
      bump();
    }, BUBBLE_MORPH_MS);
  };

  const collapseBubbles = () => {
    const fullyCompact =
      popupsCompactRef.current && expandedPopupIdsRef.current.size === 0;
    if (fullyCompact) return;

    startMorph("collapse", () => {
      setPopupsCompact(true);
      clearExpandedPopups();
    });
  };

  const POPUP_Z_BASE = 2147483640;

  const bringPopupToFront = (id) => {
    setPopups((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      if (idx < 0 || idx === prev.length - 1) return prev;
      const next = [...prev];
      const [item] = next.splice(idx, 1);
      next.push(item);
      return next;
    });
  };

  /** Expand one selection; other open bubbles stay open until scroll collapses all. */
  const expandPopup = (id) => {
    if (expandedPopupIds.has(id)) return;
    bringPopupToFront(id);
    resetScrollAccumulatedRef.current();
    if (morphTimerRef.current) clearTimeout(morphTimerRef.current);
    setMorphPopupId(id);
    setBubbleMorph("expand");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => addExpandedPopup(id));
    });
    morphTimerRef.current = setTimeout(() => {
      setBubbleMorph(null);
      setMorphPopupId(null);
      morphTimerRef.current = null;
      bump();
    }, BUBBLE_MORPH_MS);
  };

  const cancelLive = () => {
    isDrawingRef.current = false;
    pointsRef.current = [];
    const { width, height } = viewportRef.current;
    liveCtx()?.clearRect(0, 0, width, height);
  };

  useEffect(() => {
    resizeCanvases();
    const ro = new ResizeObserver(resizeCanvases);
    ro.observe(document.documentElement);

    let raf = 0;
    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        syncFrame();
      });
    };

    const onWinResize = () => {
      if (onWinResize._r) cancelAnimationFrame(onWinResize._r);
      onWinResize._r = requestAnimationFrame(resizeCanvases);
    };

    document.addEventListener("scroll", schedule, { capture: true, passive: true });
    window.addEventListener("resize", onWinResize, { passive: true });
    const vv = window.visualViewport;
    vv?.addEventListener("scroll", schedule, { passive: true });
    vv?.addEventListener("resize", schedule, { passive: true });

    let active = true;
    const loop = () => {
      if (!active) return;
      if (
        polysRef.current.length > 0 ||
        pointsRef.current.length > 0 ||
        popupsCountRef.current > 0
      ) {
        schedule();
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);

    return () => {
      active = false;
      ro.disconnect();
      document.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", onWinResize);
      vv?.removeEventListener("scroll", schedule);
      vv?.removeEventListener("resize", schedule);
      if (onWinResize._r) cancelAnimationFrame(onWinResize._r);
      if (raf) cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (popups.length === 0) {
      setPopupsCompact(false);
      setBubbleMorph(null);
      setMorphPopupId(null);
      clearExpandedPopups();
      if (morphTimerRef.current) clearTimeout(morphTimerRef.current);
      return;
    }

    const cleanup = attachScrollBubbleController({
      onCollapse: collapseBubbles,
      isFullyCompact: () =>
        popupsCompactRef.current && expandedPopupIdsRef.current.size === 0,
      isEnabled: () => autoCollapseRef.current,
    });
    resetScrollAccumulatedRef.current = cleanup.resetAccumulated;
    return () => {
      cleanup.removeListener();
      resetScrollAccumulatedRef.current = () => {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popups.length]);

  useEffect(() => {
    loadSettings().then((s) => {
      const on = isDrawingEnabled(s);
      drawingEnabledRef.current = on;
      setDrawingEnabled(on);
      autoCollapseRef.current = isAutoCollapseEnabled(s);
      lassoThemeRef.current = getLassoTheme(s.lassoTheme);
      redrawInk();
    });
    isSignedIn().then(setSignedIn);

    const onStorageChange = (changes, area) => {
      if (area === "local" && changes.syncle_session) {
        isSignedIn().then(setSignedIn);
      }
      if (area !== "sync") return;

      if (changes.enabled !== undefined) {
        const on = changes.enabled.newValue !== false;
        drawingEnabledRef.current = on;
        setDrawingEnabled(on);
        if (!on) {
          cancelLive();
          setHotkeyReady(false);
        }
      }

      if (changes.lassoTheme !== undefined) {
        lassoThemeRef.current = getLassoTheme(changes.lassoTheme.newValue);
        redrawInk();
        if (isDrawingRef.current) drawLive();
      }

      if (changes.autoCollapse !== undefined) {
        autoCollapseRef.current = changes.autoCollapse.newValue !== false;
      }
    };
    chrome.storage.onChanged.addListener(onStorageChange);
    return () => chrome.storage.onChanged.removeListener(onStorageChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const down = (e) => {
      if (!drawingEnabledRef.current) return;
      setHotkeyReady(isHotkey(e));
    };
    const up = () => setHotkeyReady(false);
    window.addEventListener("keydown", down, { capture: true });
    window.addEventListener("keyup", up, { capture: true });
    window.addEventListener("blur", up, { capture: true });
    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.visibilityState !== "visible") up();
      },
      { capture: true }
    );
    return () => {
      window.removeEventListener("keydown", down, { capture: true });
      window.removeEventListener("keyup", up, { capture: true });
      window.removeEventListener("blur", up, { capture: true });
    };
  }, []);

  const updatePopupContent = (popupId, patch) => {
    setPopups((prev) =>
      prev.map((p) =>
        p.id === popupId ? { ...p, content: { ...p.content, ...patch } } : p
      )
    );
  };

  const requestAiReply = async (popupId, contextIds) => {
    if (!contextIds?.pageContextId || !contextIds?.selectionContextId) return;

    updatePopupContent(popupId, {
      chatStatus: "loading",
      chatError: "",
      chatProvider: "",
      chatModel: "",
    });

    try {
      const result = await sendChatMessage({
        pageContextId: contextIds.pageContextId,
        selectionContextId: contextIds.selectionContextId,
        message: AUTO_CHAT_MESSAGE,
      });

      updatePopupContent(popupId, {
        chatStatus: "ready",
        chatReply: result.reply || "",
        chatProvider: result.provider || "",
        chatModel: result.model || "",
        chatError: "",
      });
    } catch (err) {
      updatePopupContent(popupId, {
        chatStatus: "error",
        chatError: err instanceof Error ? err.message : String(err),
      });
    }
  };

  useEffect(() => {
    const finishCommit = () => {
      const points = pointsRef.current;
      isDrawingRef.current = false;
      pointsRef.current = [];

      if (points.length >= 3) {
        const id = uid();
        const n = points.length;
        let cx = 0,
          cy = 0;
        for (const p of points) {
          cx += p.clientX;
          cy += p.clientY;
        }
        cx /= n;
        cy /= n;

        const anchor = pickAnchor(cx, cy);
        const clientPts = points.map((p) => ({
          x: p.clientX,
          y: p.clientY,
        }));
        const offsets = offsetsFromClientPoints(anchor, clientPts);
        const pagePts = points.map((p) => ({ x: p.pageX, y: p.pageY }));

        anchorsRef.current.set(id, anchor);
        polysRef.current.push({ id, pts: pagePts, offsets, anchor });

        redrawInk();

        const view = viewportRef.current;
        const box = bboxOf(clientPts);
        const popupOffset = placePopupOffset(box, anchor, view);
        setPopups((prev) => [
          ...prev,
          {
            id,
            popupOffset,
            content: {
              bbox: bboxOf(pagePts),
              text: "",
              extractStatus: "loading",
              chatDraft: "",
              chatReply: "",
              chatStatus: "idle",
              chatError: "",
              chatProvider: "",
              chatModel: "",
              registerStatus: CLOUD_SYNC_ENABLED ? "extracting" : "local",
            },
          },
        ]);
        // New selections open expanded even when older bubbles are collapsed.
        if (popupsCompactRef.current) {
          addExpandedPopup(id);
        }

        const registerWatchdog = setTimeout(() => {
          setPopups((prev) =>
            prev.map((p) =>
              p.id === id &&
              (p.content.registerStatus === "pending" ||
                p.content.registerStatus === "extracting")
                ? {
                    ...p,
                    content: {
                      ...p.content,
                      registerStatus: "error",
                      registerError:
                        "Register timed out. Reload the extension and ensure syncle-services is on :3001.",
                    },
                  }
                : p
            )
          );
        }, 40000);

        const runExtract = () =>
          runSelectionExtraction(clientPts, id, (registerResult) => {
            clearTimeout(registerWatchdog);
            if (registerResult.ok) {
              setPopups((prev) =>
                prev.map((p) =>
                  p.id === id
                    ? {
                        ...p,
                        content: {
                          ...p.content,
                          contextIds: {
                            pageContextId: registerResult.pageContextId,
                            selectionContextId: registerResult.selectionContextId,
                          },
                          registerStatus: "ready",
                          registerError: "",
                        },
                      }
                    : p
                )
              );
            } else {
              setPopups((prev) =>
                prev.map((p) =>
                  p.id === id
                    ? {
                        ...p,
                        content: {
                          ...p.content,
                          registerStatus:
                            registerResult.reason === "not_signed_in"
                              ? "no_session"
                              : "error",
                          registerError: registerResult.message || "",
                        },
                      }
                    : p
                )
              );
            }
          })
          .then((extracted) => {
            const preview =
              extracted.selectionEvidence?.candidates?.[0]?.text?.trim().slice(0, 280) ||
              extracted.focus.text?.trim().slice(0, 280) ||
              (extracted.focus.cropImageBase64
                ? `[Visual: ${extracted.meta.extractionStrategy}]`
                : "");
            setPopups((prev) =>
              prev.map((p) => {
                if (p.id !== id) return p;
                const reg = p.content.registerStatus;
                const registerStatus = !CLOUD_SYNC_ENABLED
                  ? "local"
                  : extracted.contextIds
                    ? "ready"
                    : reg === "ready" || reg === "error" || reg === "no_session"
                      ? reg
                      : reg === "extracting"
                        ? "pending"
                        : reg;
                const contextIds =
                  extracted.contextIds ?? p.content.contextIds;
                const canChat = Boolean(
                  contextIds?.pageContextId && contextIds?.selectionContextId
                );
                return {
                  ...p,
                  content: {
                    ...p.content,
                    text: preview,
                    extracted,
                    aiPayload: extracted.aiPayload,
                    contextIds,
                    extractStatus: "ready",
                    registerStatus,
                    chatStatus: canChat ? "loading" : p.content.chatStatus,
                  },
                };
              })
            );

            const ids = extracted.contextIds;
            if (ids?.pageContextId && ids?.selectionContextId) {
              requestAiReply(id, ids);
            }
          })
          .catch((err) => {
            clearTimeout(registerWatchdog);
            console.warn("[syncle] extraction failed:", err);
            setPopups((prev) =>
              prev.map((p) =>
                p.id === id
                  ? {
                      ...p,
                      content: {
                        ...p.content,
                        text: "Could not extract selection.",
                        extractStatus: "error",
                        registerStatus: "error",
                        registerError:
                          err instanceof Error
                            ? err.message
                            : String(err),
                      },
                    }
                  : p
              )
            );
          });

        // Defer so the popup bubble is not the topmost hit target for caret/element sampling.
        requestAnimationFrame(() => {
          requestAnimationFrame(runExtract);
        });
      }

      const { width, height } = viewportRef.current;
      liveCtx()?.clearRect(0, 0, width, height);
    };

    const start = (e) => {
      if (!(e instanceof PointerEvent)) return;
      if (!drawingEnabledRef.current) return;
      if (!isAiProductMode(productModeRef.current)) return;
      if (!isHotkey(e)) return;
      if (e.button !== 0) return;
      isDrawingRef.current = true;
      pointsRef.current = [
        {
          clientX: e.clientX,
          clientY: e.clientY,
          pageX: e.pageX,
          pageY: e.pageY,
        },
      ];
      drawLive();
      e.preventDefault();
    };

    const move = (e) => {
      if (!isDrawingRef.current) return;
      if (!isHotkey(e)) return finishCommit();
      const pts = pointsRef.current;
      const last = pts[pts.length - 1];
      if (
        (e.clientX - last.clientX) ** 2 + (e.clientY - last.clientY) ** 2 <
        2
      ) {
        return;
      }
      pts.push({
        clientX: e.clientX,
        clientY: e.clientY,
        pageX: e.pageX,
        pageY: e.pageY,
      });
      drawLive();
      e.preventDefault();
    };

    const end = (e) => {
      if (!isDrawingRef.current) return;
      if (e.type === "pointerup" && e.button !== 0) return;
      finishCommit();
      e.preventDefault();
    };

    const esc = (e) => {
      if (e.key !== "Escape") return;
      if (!isDrawingRef.current) return;
      cancelLive();
    };

    window.addEventListener("pointerdown", start, { capture: true });
    window.addEventListener("pointermove", move, { capture: true });
    window.addEventListener("pointerup", end, { capture: true });
    window.addEventListener("pointercancel", end, { capture: true });
    window.addEventListener("keydown", esc, { capture: true });

    return () => {
      window.removeEventListener("pointerdown", start, { capture: true });
      window.removeEventListener("pointermove", move, { capture: true });
      window.removeEventListener("pointerup", end, { capture: true });
      window.removeEventListener("pointercancel", end, { capture: true });
      window.removeEventListener("keydown", esc, { capture: true });
    };
  }, []);

  const undo = () => {
    const last = polysRef.current.pop();
    if (last) {
      anchorsRef.current.delete(last.id);
      setPopups((prev) => prev.filter((p) => p.id !== last.id));
      setExpandedPopupIds((prev) => {
        if (!prev.has(last.id)) return prev;
        const next = new Set(prev);
        next.delete(last.id);
        return next;
      });
      redrawInk();
      bump();
    }
  };

  const clearAll = () => {
    polysRef.current.length = 0;
    anchorsRef.current.clear();
    setPopups([]);
    clearExpandedPopups();
    redrawInk();
    bump();
  };

  const removeSelection = (id) => {
    autoSummaryStartedRef.current.delete(id);
    polysRef.current = polysRef.current.filter((p) => p.id !== id);
    anchorsRef.current.delete(id);
    setPopups((prev) => prev.filter((p) => p.id !== id));
    setExpandedPopupIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    if (polysRef.current.length === 0) {
      setPopupsCompact(false);
      setBubbleMorph(null);
      setMorphPopupId(null);
      clearExpandedPopups();
    }
    redrawInk();
    bump();
  };

  const minimizePopup = (id) => {
    if (popupsCompact && !expandedPopupIds.has(id)) return;

    resetScrollAccumulatedRef.current();
    if (morphTimerRef.current) clearTimeout(morphTimerRef.current);
    setMorphPopupId(id);
    setBubbleMorph("collapse");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setPopupsCompact(true);
        setExpandedPopupIds((prev) => {
          if (!prev.has(id)) return prev;
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      });
    });
    morphTimerRef.current = setTimeout(() => {
      setBubbleMorph(null);
      setMorphPopupId(null);
      morphTimerRef.current = null;
      bump();
    }, BUBBLE_MORPH_MS);
  };

  const popupNodes = popups.map((p, stackIndex) => {
    const poly = polysRef.current.find((poly) => poly.id === p.id);
    const anchor = getAnchor(p.id);
    const pos = clientPointFromAnchor(anchor, p.popupOffset);
    if (!pos || !poly) return null;

    const centroid = getSelectionCentroid(anchor, poly.offsets, poly.pts);
    const colors = lassoThemeRef.current;
    const isCompact = popupsCompact && !expandedPopupIds.has(p.id);
    const showMorph =
      bubbleMorph === "collapse"
        ? bubbleMorph
        : bubbleMorph === "expand" && morphPopupId === p.id
          ? "expand"
          : null;

    const node = (
      <PopupBubble
        key={p.id}
        x={pos.x}
        y={pos.y}
        centroidX={centroid?.x}
        centroidY={centroid?.y}
        compact={isCompact}
        morph={showMorph ? bubbleMorph : null}
        accentColor={colors.border}
        fillColor={colors.fill}
        zIndex={POPUP_Z_BASE + stackIndex}
        onMinimize={() => minimizePopup(p.id)}
        onDismiss={() => removeSelection(p.id)}
        onBringToFront={() => bringPopupToFront(p.id)}
        onExpand={() => expandPopup(p.id)}
      >
        <div style={{ marginBottom: 6 }}>
          <div>
            <b>Lasso ID:</b> {p.id.slice(0, 8)}
          </div>
          <div>
            <b>Vertices:</b> {poly.pts.length}
          </div>
          <div>
            <b>BBox:</b> {Math.round(p.content.bbox.w)}×
            {Math.round(p.content.bbox.h)} px
          </div>
        </div>
        {p.content.extractStatus === "loading" && (
          <div style={{ marginTop: 6 }}>
            <b>Working…</b> <i>Extracting selection and preparing AI reply</i>
          </div>
        )}
        {p.content.extractStatus === "error" && (
          <div style={{ marginTop: 6 }}>
            <b>Extract failed:</b>{" "}
            <i>
              {p.content.registerError ||
                p.content.text ||
                "Could not read selection"}
            </i>
          </div>
        )}
        {p.content.extractStatus === "ready" && p.content.extracted && (
          <>
            <div
              style={{
                marginTop: 10,
                borderTop: "1px solid rgba(0,0,0,0.12)",
                paddingTop: 8,
              }}
            >
              <b style={{ fontSize: 13 }}>AI response</b>
              {p.content.chatStatus === "loading" && (
                <p style={{ margin: "8px 0 0", fontSize: 12, opacity: 0.75 }}>
                  <i>Thinking…</i>
                </p>
              )}
              {p.content.chatStatus === "ready" && (
                <div style={{ marginTop: 8 }}>
                  <div
                    style={{
                      fontSize: 12,
                      lineHeight: 1.45,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {p.content.chatReply}
                  </div>
                  {(p.content.chatProvider || p.content.chatModel) && (
                    <div style={{ marginTop: 6, fontSize: 10, opacity: 0.6 }}>
                      {p.content.chatProvider || "ai"}
                      {p.content.chatModel ? ` · ${p.content.chatModel}` : ""}
                    </div>
                  )}
                </div>
              )}
              {p.content.chatStatus === "error" && (
                <p style={{ margin: "8px 0 0", fontSize: 11, color: "#b91c1c" }}>
                  {p.content.chatError || "Could not fetch AI response."}
                </p>
              )}
            </div>

            {p.content.chatStatus === "loading" && (
              <p style={{ margin: "8px 0 0", fontSize: 12, opacity: 0.75 }}>
                <i>Analyzing…</i>
              </p>
            )}
          </>
        )}
      </PopupBubble>
    );

    return toolbarMount ? createPortal(node, toolbarMount) : node;
  });

  const handleProductModeChange = (mode) => {
    setProductMode(mode);
    if (!isAiProductMode(mode)) {
      cancelLive();
      setHotkeyReady(false);
    }
  };

  const toolbar = (
    <FloatingToolbar
      productMode={productMode}
      onProductModeChange={handleProductModeChange}
      drawingEnabled={drawingEnabled && isAiProductMode(productMode)}
      hotkeyReady={hotkeyReady && isAiProductMode(productMode)}
      onUndo={undo}
      onClear={clearAll}
      viewport={viewport}
    />
  );

  return (
    <div
      className="draw-root"
      style={{
        position: "fixed",
        inset: 0,
        width: viewport.width,
        height: viewport.height,
        pointerEvents: "none",
      }}
    >
      <canvas
        ref={inkCanvasRef}
        className="draw-canvas-wrap"
        style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}
      />
      <canvas
        ref={liveCanvasRef}
        className="draw-canvas-wrap"
        style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}
      />

      {toolbarMount ? createPortal(toolbar, toolbarMount) : toolbar}

      {popupNodes}
    </div>
  );
}

function placePopupOffset(clientBox, anchor, view) {
  const margin = 8;
  const estW = 260;
  const estH = 160;
  const ar = anchor.getBoundingClientRect();

  let x = clientBox.maxX + margin;
  let y = clientBox.minY;

  if (x + estW > view.width) x = Math.max(margin, clientBox.minX - estW - margin);
  if (y + estH > view.height) y = Math.max(margin, view.height - estH - margin);
  if (y < margin) y = margin;

  return { dx: x - ar.left, dy: y - ar.top };
}
