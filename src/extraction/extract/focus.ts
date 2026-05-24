import type { SelectionRect } from "../types.js";
import type { FocusExtractionMethod, Point2D } from "../types.js";
import { extractFocusFromSelection } from "../focus/extractFocusCandidates.js";

export type { FocusExtractionResult } from "../focus/types.js";

export function extractFocusText(
  rect: SelectionRect,
  elements: Element[]
): string {
  return extractFocusWithDetails(rect, elements).text;
}

/** Polygon-first, candidate-scored focus extraction. */
export function extractFocusWithDetails(
  rect: SelectionRect,
  elements: Element[],
  polygon?: Point2D[]
): import("../focus/types.js").FocusExtractionResult {
  return extractFocusFromSelection(rect, elements, polygon);
}
