import type { SelectionRect } from "../types.js";
import type { Point2D } from "../types.js";
import {
  distance,
  pointInPolygon,
  polygonCentroid,
  rectIntersectsPolygon,
} from "../geometry/polygon.js";
import { intersectionArea, rectsIntersect } from "../geometry/rect.js";
import type { DOMRectLike } from "./types.js";

export function toRectLike(rect: DOMRect | SelectionRect): DOMRectLike {
  return {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  };
}

export function rectCenter(rect: DOMRectLike): Point2D {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

export function lassoCenterFrom(
  bbox: SelectionRect,
  polygon?: Point2D[]
): Point2D {
  if (polygon && polygon.length >= 3) return polygonCentroid(polygon);
  return { x: bbox.left + bbox.width / 2, y: bbox.top + bbox.height / 2 };
}

export function distanceToSelectionCenter(
  rect: DOMRectLike,
  center: Point2D
): number {
  return distance(rectCenter(rect), center);
}

export function overlapRatioWithRect(
  inner: DOMRectLike,
  outer: SelectionRect
): number {
  const area = Math.max(1, inner.width * inner.height);
  const overlap = intersectionArea(outer, inner as DOMRect);
  return overlap / area;
}

export function hitsPolygon(
  rect: DOMRectLike,
  polygon: Point2D[] | undefined,
  bbox: SelectionRect
): { centerInside: boolean; intersects: boolean; bboxOnly: boolean } {
  const hasPolygon = Boolean(polygon && polygon.length >= 3);
  const center = rectCenter(rect);
  if (hasPolygon) {
    const centerInside = pointInPolygon(center, polygon!);
    const intersects =
      centerInside || rectIntersectsPolygon(rect as DOMRect, polygon!);
    return { centerInside, intersects, bboxOnly: !intersects && rectsIntersect(bbox, rect as DOMRect) };
  }
  return {
    centerInside: false,
    intersects: rectsIntersect(bbox, rect as DOMRect),
    bboxOnly: rectsIntersect(bbox, rect as DOMRect),
  };
}

export function sameVisualLine(a: DOMRectLike, b: DOMRectLike, tolerance = 10): boolean {
  return Math.abs(a.top + a.height / 2 - (b.top + b.height / 2)) <= tolerance;
}
