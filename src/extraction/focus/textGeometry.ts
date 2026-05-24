import type { Point2D } from "../types.js";
import type { SelectionRect } from "../types.js";
import { pointInPolygon } from "../geometry/polygon.js";
import { intersectionArea } from "../geometry/rect.js";
import type { DOMRectLike } from "./types.js";
import { rectCenter } from "./geometry.js";

/** Horizontal span of polygon points near a visual line. */
export function polygonHorizontalSpan(
  polygon: Point2D[],
  centerY: number,
  lineTolerance: number
): { minX: number; maxX: number } {
  const band = polygon.filter((p) => Math.abs(p.y - centerY) <= lineTolerance);
  const pts = band.length >= 2 ? band : polygon;
  let minX = Infinity;
  let maxX = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
  }
  return { minX, maxX };
}

/** Approximate fraction of a rect covered by polygon (sample grid). */
export function polygonCoverageRatio(
  rect: DOMRectLike,
  polygon: Point2D[] | undefined,
  bbox: SelectionRect
): number {
  if (!polygon || polygon.length < 3) {
    const area = Math.max(1, rect.width * rect.height);
    return intersectionArea(bbox, rect as DOMRect) / area;
  }

  const samples = 9;
  let inside = 0;
  for (let ix = 0; ix < 3; ix++) {
    for (let iy = 0; iy < 3; iy++) {
      const p = {
        x: rect.left + (rect.width * (ix + 0.5)) / 3,
        y: rect.top + (rect.height * (iy + 0.5)) / 3,
      };
      if (pointInPolygon(p, polygon)) inside++;
    }
  }
  return inside / samples;
}

export function charHitsSelection(
  rect: DOMRect,
  polygon: Point2D[] | undefined,
  bbox: SelectionRect,
  minCoverage = 0.15
): boolean {
  if (rect.width <= 0 || rect.height <= 0) return false;
  const center = rectCenter({
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  });
  if (polygon && polygon.length >= 3) {
    if (pointInPolygon(center, polygon)) return true;
    return polygonCoverageRatio(rect, polygon, bbox) >= minCoverage;
  }
  return intersectionArea(bbox, rect) > 0;
}

export function estimateLineHeight(fromRect: DOMRect | null): number {
  if (fromRect && fromRect.height > 4) return fromRect.height;
  return 18;
}
