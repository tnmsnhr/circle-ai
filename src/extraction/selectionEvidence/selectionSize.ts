import type { SelectionRect } from "../types.js";
import type { FocusExtractionContext } from "../focus/types.js";

export type SelectionSizeClass = "small" | "medium" | "large";

const SMALL_AREA_MAX = 28_000;
const LARGE_AREA_MIN = 95_000;
const LARGE_VIEWPORT_RATIO = 0.07;

export function classifySelectionSize(
  ctx: FocusExtractionContext,
  viewport?: { width: number; height: number }
): SelectionSizeClass {
  const area = ctx.selectionArea;
  const vw = viewport?.width ?? window.innerWidth;
  const vh = viewport?.height ?? window.innerHeight;
  const viewportArea = Math.max(1, vw * vh);
  const ratio = area / viewportArea;

  if (area < SMALL_AREA_MAX) return "small";
  if (area >= LARGE_AREA_MIN || ratio >= LARGE_VIEWPORT_RATIO) return "large";
  if (area >= 48_000 && ctx.bbox.height > 120) return "large";
  return "medium";
}

export function selectionRectArea(rect: SelectionRect): number {
  return rect.width * rect.height;
}
