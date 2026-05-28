import type { SelectionRect } from "../types.js";

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
  const left = Math.min(minX, maxX);
  const top = Math.min(minY, maxY);
  const right = Math.max(minX, maxX);
  const bottom = Math.max(minY, maxY);
  return {
    left,
    top,
    right,
    bottom,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  };
}
