import type { SelectionRect } from "../types.js";

/** Build a normalized selection rect from corner bounds. */
export function normalizeRect(
  left: number,
  top: number,
  right: number,
  bottom: number
): SelectionRect {
  const l = Math.min(left, right);
  const t = Math.min(top, bottom);
  const r = Math.max(left, right);
  const b = Math.max(top, bottom);
  return {
    left: l,
    top: t,
    right: r,
    bottom: b,
    width: Math.max(1, r - l),
    height: Math.max(1, b - t),
  };
}

/** Bounding box from polygon points `{ x, y }` in client coordinates. */
export function rectFromPoints(
  points: Array<{ x: number; y: number }>
): SelectionRect {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return normalizeRect(minX, minY, maxX, maxY);
}

/** Expand rect by `px` on each side, clamped to viewport. */
export function expandRect(
  rect: SelectionRect,
  px: number,
  viewport?: { width: number; height: number }
): SelectionRect {
  const left = rect.left - px;
  const top = rect.top - px;
  const right = rect.right + px;
  const bottom = rect.bottom + px;
  if (!viewport) {
    return normalizeRect(left, top, right, bottom);
  }
  return normalizeRect(
    Math.max(0, left),
    Math.max(0, top),
    Math.min(viewport.width, right),
    Math.min(viewport.height, bottom)
  );
}

export function rectsIntersect(
  a: SelectionRect,
  b: { left: number; top: number; right: number; bottom: number }
): boolean {
  return !(
    a.right < b.left ||
    a.left > b.right ||
    a.bottom < b.top ||
    a.top > b.bottom
  );
}

/** Intersection area between selection and element box (CSS px²). */
export function intersectionArea(
  rect: SelectionRect,
  box: DOMRect
): number {
  const left = Math.max(rect.left, box.left);
  const top = Math.max(rect.top, box.top);
  const right = Math.min(rect.right, box.right);
  const bottom = Math.min(rect.bottom, box.bottom);
  if (right <= left || bottom <= top) return 0;
  return (right - left) * (bottom - top);
}

export function elementBox(el: Element): DOMRect {
  return el.getBoundingClientRect();
}
