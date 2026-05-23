/** Element under the pointer, skipping our extension host. */
export function pickAnchor(clientX, clientY) {
  const x = Math.max(0, Math.min(window.innerWidth - 1, clientX));
  const y = Math.max(0, Math.min(window.innerHeight - 1, clientY));
  let el = document.elementFromPoint(x, y);
  while (el?.id === "draw-on-web-root-host") {
    el = el.parentElement;
  }
  if (!el) return document.body || document.documentElement;

  // Prefer a stable block (feed card, paragraph) over a tiny text node wrapper.
  let best = el;
  for (let node = el; node && node !== document.body; node = node.parentElement) {
    if (node.id === "draw-on-web-root-host") continue;
    const style = window.getComputedStyle(node);
    if (style.position === "fixed" || style.position === "sticky") continue;
    const r = node.getBoundingClientRect();
    if (r.width >= 48 && r.height >= 24) {
      best = node;
      break;
    }
  }
  return best;
}

/** Center of a selection in viewport coordinates. */
export function getSelectionCentroid(anchor, offsets, pagePtsFallback) {
  const pts = clientPointsFromAnchor(anchor, offsets, pagePtsFallback);
  if (!pts?.length) return null;
  let x = 0;
  let y = 0;
  for (const p of pts) {
    x += p.x;
    y += p.y;
  }
  return { x: x / pts.length, y: y / pts.length };
}

export function getViewportSize() {
  const vv = window.visualViewport;
  return {
    width: vv?.width ?? window.innerWidth,
    height: vv?.height ?? window.innerHeight,
  };
}

/** Viewport points from anchor-relative offsets (moves with nested scroll). */
export function clientPointsFromAnchor(anchor, offsets, pagePtsFallback) {
  if (anchor?.isConnected) {
    const { left, top } = anchor.getBoundingClientRect();
    return offsets.map(({ dx, dy }) => ({ x: left + dx, y: top + dy }));
  }
  if (pagePtsFallback?.length) {
    return pagePtsFallback.map((p) => ({
      x: p.x - window.scrollX,
      y: p.y - window.scrollY,
    }));
  }
  return null;
}

export function clientPointFromAnchor(anchor, offset) {
  if (!anchor?.isConnected || !offset) return null;
  const { left, top } = anchor.getBoundingClientRect();
  return { x: left + offset.dx, y: top + offset.dy };
}

/** Offsets from anchor top-left for a list of viewport points. */
export function offsetsFromClientPoints(anchor, clientPoints) {
  const { left, top } = anchor.getBoundingClientRect();
  return clientPoints.map(({ x, y }) => ({ dx: x - left, dy: y - top }));
}
