// OverlayLasso.jsx
import React, { useEffect, useRef, useState } from "react";

const isHotkey = (e) => e.metaKey

// doc size
function getPageSize() {
  const el = document.documentElement;
  const b = document.body || {};
  const w = Math.max(el.scrollWidth, el.offsetWidth, el.clientWidth, b.scrollWidth || 0, b.offsetWidth || 0);
  const h = Math.max(el.scrollHeight, el.offsetHeight, el.clientHeight, b.scrollHeight || 0, b.offsetHeight || 0);
  return { width: w, height: h };
}

export default function OverlayApp() {
  const [hotkeyReady, setHotkeyReady] = useState(false); // Cmd+Ctrl hint
  const [isDrawing, setIsDrawing] = useState(false);
  const [pageSize, setPageSize] = useState(getPageSize());

  const liveCanvasRef = useRef(null);  // live (rubber-band) layer
  const inkCanvasRef  = useRef(null);  // committed shapes layer
  const pointsRef     = useRef([]);    // current polygon points [{x,y}]
  const polysRef      = useRef([]);    // committed polygons [[{x,y},...], ...]

  // resize canvases to doc with DPR
  const resizeCanvases = () => {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const { width, height } = getPageSize();
    setPageSize({ width, height });

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

    // clear & redraw
    liveCtx()?.clearRect(0, 0, width, height);
    redrawInk();
  };

  const liveCtx = () => liveCanvasRef.current?.getContext("2d");
  const inkCtx  = () =>  inkCanvasRef.current?.getContext("2d");

  // full redraw of committed polys
  const redrawInk = () => {
    const ctx = inkCtx();
    if (!ctx) return;
    const { width, height } = pageSize;
    ctx.clearRect(0, 0, width, height);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#22c55e";
    ctx.fillStyle = "rgba(34,197,94,0.12)";
    for (const pts of polysRef.current) {
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

  // hotkey hint only (Cmd+Ctrl)
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

  // pointer handlers (capture phase)
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
      if (!isCombo(e)) return finish(false); // commit even if combo released mid-stroke
      const pts = pointsRef.current;
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
      finish(true);
      e.preventDefault();
    };

    const finish = (fromPointer = true) => {
      // commit polygon if it has enough points
      if (pointsRef.current.length >= 3) {
        // close polygon visually
        const pts = pointsRef.current.slice();
        polysRef.current.push(pts);
        redrawInk();
      }
      // clear live
      setIsDrawing(false);
      pointsRef.current = [];
      const l = liveCtx();
      if (l) l.clearRect(0, 0, pageSize.width, pageSize.height);
    };

    const esc = (e) => {
      if (e.key !== "Escape") return;
      // cancel current lasso without commit
      if (!isDrawing) return;
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

  // live rubber-band
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
    // show “closing” edge
    if (pts.length > 1) ctx.lineTo(pts[0].x, pts[0].y);

    ctx.strokeStyle = "#00b3ff";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.stroke();
    ctx.setLineDash([]);
  };

  // actions
  const onUndo = () => {
    polysRef.current.pop();
    redrawInk();
  };
  const onClear = () => {
    polysRef.current = { current: [] }; // reset ref safely
    polysRef.current = { current: [] }; // ensure actual array
  };

  // fix: proper clear implementation
  const clearAll = () => {
    polysRef.current = { current: [] }; // wrong pattern; use below
  };

  // Correct clear:
  const clearInk = () => {
    polysRef.current.length = 0;
    redrawInk();
  };

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: pageSize.width,
        height: pageSize.height,
        zIndex: 2147483647,
        pointerEvents: "none"  // click-through always
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
        <span>Hold <b>⌘+Ctrl</b> and drag to lasso {hotkeyReady ? "(ready)" : ""}</span>
        <button onClick={() => { polysRef.current.pop(); redrawInk(); }}>Undo</button>
        <button onClick={() => { polysRef.current.length = 0; redrawInk(); }}>Clear</button>
      </div>
    </div>
  );
}
