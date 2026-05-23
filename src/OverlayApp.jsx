// OverlayLasso.jsx
import React, { useEffect, useRef, useState } from "react";

import PopupBubble from "./components/PopupBubble.jsx";
import {
  uid,
  bboxOf,
  pickAnchor,
  getViewportSize,
  clientPointsFromAnchor,
  clientPointFromAnchor,
  offsetsFromClientPoints,
} from "./utils";

const isHotkey = (e) => e.metaKey;

export default function OverlayApp() {
  const [hotkeyReady, setHotkeyReady] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [viewport, setViewport] = useState(getViewportSize());
  const [, setFrame] = useState(0);

  const [popups, setPopups] = useState([]);

  const liveCanvasRef = useRef(null);
  const inkCanvasRef = useRef(null);
  /** @type {React.MutableRefObject<Array<{clientX:number,clientY:number,pageX:number,pageY:number}>>} */
  const pointsRef = useRef([]);
  /** @type {React.MutableRefObject<Array<{id:string,pts:Array<{x:number,y:number}>,offsets:Array<{dx:number,dy:number}>,anchor:Element}>>} */
  const polysRef = useRef([]);
  const anchorsRef = useRef(new Map());

  const liveCtx = () => liveCanvasRef.current?.getContext("2d");
  const inkCtx = () => inkCanvasRef.current?.getContext("2d");

  const getAnchor = (id) => {
    const a = anchorsRef.current.get(id);
    return a?.isConnected ? a : null;
  };

  const bump = () => setFrame((n) => n + 1);

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

  const redrawInk = () => {
    const ctx = inkCtx();
    if (!ctx) return;
    const { width, height } = viewport;
    ctx.clearRect(0, 0, width, height);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#22c55e";
    ctx.fillStyle = "rgba(34,197,94,0.12)";

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

  const syncFrame = () => {
    redrawInk();
    bump();
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
      if (polysRef.current.length > 0 || pointsRef.current.length > 0) {
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
    const down = (e) => setHotkeyReady(isHotkey(e));
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

  useEffect(() => {
    const isCombo = (e) => isHotkey(e);

    const start = (e) => {
      if (!(e instanceof PointerEvent)) return;
      if (!isCombo(e)) return;
      if (e.button !== 0) return;
      setIsDrawing(true);
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
      if (!isDrawing) return;
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
      const points = pointsRef.current;
      setIsDrawing(false);
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

        const box = bboxOf(clientPts);
        const popupOffset = placePopupOffset(box, anchor, viewport);
        setPopups((prev) => [
          ...prev,
          {
            id,
            popupOffset,
            content: {
              bbox: bboxOf(pagePts),
              text: "dummy text",
            },
          },
        ]);
      }

      liveCtx()?.clearRect(0, 0, viewport.width, viewport.height);
    };

    const cancelLive = () => {
      setIsDrawing(false);
      pointsRef.current = [];
      liveCtx()?.clearRect(0, 0, viewport.width, viewport.height);
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
  }, [isDrawing, viewport.width, viewport.height]);

  const drawLive = () => {
    const ctx = liveCtx();
    if (!ctx) return;
    const { width, height } = viewport;
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

    ctx.strokeStyle = "#00b3ff";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.stroke();
    ctx.setLineDash([]);
  };

  const undo = () => {
    const last = polysRef.current.pop();
    if (last) {
      anchorsRef.current.delete(last.id);
      setPopups((prev) => prev.filter((p) => p.id !== last.id));
      redrawInk();
      bump();
    }
  };

  const clearAll = () => {
    polysRef.current.length = 0;
    anchorsRef.current.clear();
    setPopups([]);
    redrawInk();
    bump();
  };

  const closePopup = (id) =>
    setPopups((prev) => prev.filter((p) => p.id !== id));

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        width: viewport.width,
        height: viewport.height,
        zIndex: 2147483647,
        pointerEvents: "none",
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
          alignItems: "center",
        }}
      >
        <span>
          Hold <b>⌘+Ctrl</b> and drag {hotkeyReady ? "(ready)" : ""}
        </span>
        <button onClick={undo}>Undo</button>
        <button onClick={clearAll}>Clear</button>
      </div>

      {popups.map((p) => {
        const anchor = getAnchor(p.id);
        const pos = clientPointFromAnchor(anchor, p.popupOffset);
        if (!pos) return null;
        return (
          <PopupBubble
            key={p.id}
            x={pos.x}
            y={pos.y}
            onClose={() => closePopup(p.id)}
          >
            <div style={{ marginBottom: 6 }}>
              <div>
                <b>Lasso ID:</b> {p.id.slice(0, 8)}
              </div>
              <div>
                <b>Vertices:</b>{" "}
                {polysRef.current.find((poly) => poly.id === p.id)?.pts
                  .length ?? 0}
              </div>
              <div>
                <b>BBox:</b> {Math.round(p.content.bbox.w)}×
                {Math.round(p.content.bbox.h)} px
              </div>
            </div>
            <div style={{ marginTop: 6 }}>
              <b>Text:</b> {p.content.text || <i>No text detected</i>}
            </div>
            <div style={{ fontSize: 12, color: "#555" }}>
              This popup is independent — you can render per-lasso actions.
            </div>
          </PopupBubble>
        );
      })}
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
