// OverlayLasso.jsx
import React, { useEffect, useRef, useState } from "react";

import PopupBubble from "./components/PopupBubble.jsx";
import {getPageSize, uid, bboxOf} from "./utils"

const isHotkey = (e) => e.metaKey

export default function OverlayApp() {
   const [hotkeyReady, setHotkeyReady] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [pageSize, setPageSize] = useState(getPageSize());

  // Multiple popups, one per polygon: [{ id, x, y, content }]
  const [popups, setPopups] = useState([]);

  const liveCanvasRef = useRef(null);
  const inkCanvasRef  = useRef(null);
  const pointsRef     = useRef([]);                 // current live points
  const polysRef      = useRef([]);                 // committed: [{ id, pts }]

  const liveCtx = () => liveCanvasRef.current?.getContext("2d");
  const inkCtx  = () =>  inkCanvasRef.current?.getContext("2d");

  // Size canvases to doc (with DPR) and redraw
  const resizeCanvases = () => {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const { width, height } = getPageSize();
    setPageSize({ width, height });

    for (const c of [liveCanvasRef.current, inkCanvasRef.current]) {
      if (!c) continue;
      c.style.width = `${width}px`;
      c.style.height = `${height}px`;
      c.width  = Math.ceil(width * dpr);
      c.height = Math.ceil(height * dpr);
      const ctx = c.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
    }

    // Clear live and redraw ink
    liveCtx()?.clearRect(0, 0, width, height);
    redrawInk();

    // Re-clamp all popups within page bounds
    setPopups((prev) => prev.map(p => clampPopup(p, width, height)));
  };

  const redrawInk = () => {
    const ctx = inkCtx();
    if (!ctx) return;
    const { width, height } = pageSize;
    ctx.clearRect(0, 0, width, height);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#22c55e";
    ctx.fillStyle = "rgba(34,197,94,0.12)";
    for (const { pts } of polysRef.current) {
      if (pts.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  };

  useEffect(() => {
    resizeCanvases();
    const ro = new ResizeObserver(resizeCanvases);
    ro.observe(document.documentElement);

    const onWinResizeOrScroll = () => {
      if (onWinResizeOrScroll._r) cancelAnimationFrame(onWinResizeOrScroll._r);
      onWinResizeOrScroll._r = requestAnimationFrame(resizeCanvases);
    };
    window.addEventListener("resize", onWinResizeOrScroll, { passive: true });
    window.addEventListener("scroll", onWinResizeOrScroll, { passive: true });

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", onWinResizeOrScroll);
      window.removeEventListener("scroll", onWinResizeOrScroll);
      if (onWinResizeOrScroll._r) cancelAnimationFrame(onWinResizeOrScroll._r);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // hotkey hint (Cmd+Ctrl) — visual only
  useEffect(() => {
    const down = (e) => setHotkeyReady(isHotkey(e));
    const up   = () => setHotkeyReady(false);
    window.addEventListener("keydown", down, { capture: true });
    window.addEventListener("keyup", up,   { capture: true });
    window.addEventListener("blur", up,    { capture: true });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") up();
    }, { capture: true });
    return () => {
      window.removeEventListener("keydown", down, { capture: true });
      window.removeEventListener("keyup", up,     { capture: true });
      window.removeEventListener("blur", up,      { capture: true });
    };
  }, []);

  // pointer handlers
  useEffect(() => {
    const isCombo = (e) => isHotkey(e);

    const start = (e) => {
      if (!(e instanceof PointerEvent)) return;
      if (!isCombo(e)) return;
      if (e.button !== 0) return;
      setIsDrawing(true);
      pointsRef.current = [{ x: e.pageX, y: e.pageY }];
      drawLive();
      e.preventDefault();
    };

    const move = (e) => {
      if (!isDrawing) return;
      const pts = pointsRef.current;
      // commit if combo released mid-stroke
      if (!(isHotkey(e))) return finishCommit();
      const last = pts[pts.length - 1];
      const x = e.pageX, y = e.pageY;
      const dx = x - last.x, dy = y - last.y;
      if (dx * dx + dy * dy < 2) return;
      pts.push({ x, y });
      drawLive();
      e.preventDefault();
    };

    const end = (e) => {
      if (!isDrawing) return;
      if (e.type === "pointerup" && e.button !== 0) return;
      finishCommit();
      e.preventDefault();
    };

    const esc = (e) => {
      if (e.key !== "Escape") return;
      if (!isDrawing) return;
      cancelLive();
    };

    const finishCommit = () => {
      const pts = pointsRef.current;
      setIsDrawing(false);
      if (pts.length >= 3) {
        const id = uid();
        // 1) commit polygon
        polysRef.current.push({ id, pts: pts.slice() });
        redrawInk();
        // 2) create popup for this polygon
        const box = bboxOf(pts);
        setPopups((prev) => [...prev, placePopupForBox(id, box, pageSize)]);
      }
      // clear live
      pointsRef.current = [];
      const l = liveCtx();
      if (l) l.clearRect(0, 0, pageSize.width, pageSize.height);
    };

    const cancelLive = () => {
      setIsDrawing(false);
      pointsRef.current = [];
      const l = liveCtx();
      if (l) l.clearRect(0, 0, pageSize.width, pageSize.height);
    };

    window.addEventListener("pointerdown", start, { capture: true });
    window.addEventListener("pointermove", move,  { capture: true });
    window.addEventListener("pointerup",   end,   { capture: true });
    window.addEventListener("pointercancel", end, { capture: true });
    window.addEventListener("keydown", esc, { capture: true });

    return () => {
      window.removeEventListener("pointerdown", start, { capture: true });
      window.removeEventListener("pointermove", move,  { capture: true });
      window.removeEventListener("pointerup",   end,   { capture: true });
      window.removeEventListener("pointercancel", end, { capture: true });
      window.removeEventListener("keydown", esc, { capture: true });
    };
  }, [isDrawing, pageSize.width, pageSize.height]);

  // live rubber band
  const drawLive = () => {
    const ctx = liveCtx();
    if (!ctx) return;
    const { width, height } = pageSize;
    ctx.clearRect(0, 0, width, height);
    const pts = pointsRef.current;
    if (!pts.length) return;

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    if (pts.length > 1) ctx.lineTo(pts[0].x, pts[0].y);

    ctx.strokeStyle = "#00b3ff";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.stroke();
    ctx.setLineDash([]);
  };

  // popup placement helpers
  const placePopupForBox = (id, box, page) => {
    const margin = 8;
    const estW = 260;
    const estH = 160;

    // default: right side, top-aligned
    let x = box.maxX + margin;
    let y = box.minY;

    // if overflow right, flip to left
    if (x + estW > page.width) x = Math.max(0, box.minX - estW - margin);
    // clamp Y within page
    if (y + estH > page.height) y = Math.max(0, page.height - estH - margin);
    if (y < 0) y = 0;

    return {
      id,
      x,
      y,
      content: {
        vertices: Math.max(0, Math.round(box.w + box.h) /* demo */),
        bbox: box
      }
    };
  };

  const clampPopup = (p, pageW, pageH) => {
    const estW = 260, estH = 160, m = 8;
    let x = p.x, y = p.y;
    if (x + estW > pageW) x = pageW - estW - m;
    if (y + estH > pageH) y = pageH - estH - m;
    if (x < 0) x = 0;
    if (y < 0) y = 0;
    return { ...p, x, y };
  };

  // actions
  const undo = () => {
    const last = polysRef.current.pop();
    if (last) {
      setPopups((prev) => prev.filter(p => p.id !== last.id));
      redrawInk();
    }
  };
  const clearAll = () => {
    polysRef.current.length = 0;
    setPopups([]);
    redrawInk();
  };
  const closePopup = (id) => setPopups((prev) => prev.filter(p => p.id !== id));

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: pageSize.width,
        height: pageSize.height,
        zIndex: 2147483647,
        pointerEvents: "none" // page remains clickable
      }}
    >
      <canvas
        ref={inkCanvasRef}
        style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}
      />
      <canvas
        ref={liveCanvasRef}
        style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}
      />

      {/* Toolbar (clickable) */}
      <div
        style={{
          position: "fixed",
          right: 16,
          bottom: 16,
          background: "rgba(20,20,20,0.85)",
          color: "#fff",
          borderRadius: 10,
          padding: "6px 10px",
          fontSize: 12,
          pointerEvents: "auto",
          display: "flex",
          gap: 8,
          alignItems: "center"
        }}
      >
        <span>Hold <b>⌘+Ctrl</b> and drag {hotkeyReady ? "(ready)" : ""}</span>
        <button onClick={undo}>Undo</button>
        <button onClick={clearAll}>Clear</button>
      </div>

      {/* One popup per lasso */}
      {popups.map((p) => (
        <PopupBubble key={p.id} x={p.x} y={p.y} onClose={() => closePopup(p.id)}>
          <div style={{ marginBottom: 6 }}>
            <div><b>Lasso ID:</b> {p.id.slice(0, 8)}</div>
            <div><b>Vertices:</b> {polysRef.current.find(poly => poly.id === p.id)?.pts.length ?? 0}</div>
            <div><b>BBox:</b> {Math.round(p.content.bbox.w)}×{Math.round(p.content.bbox.h)} px</div>
          </div>
          <div style={{ fontSize: 12, color: "#555" }}>
            This popup is independent — you can render per-lasso actions.
          </div>
        </PopupBubble>
      ))}
    </div>
  );
}
