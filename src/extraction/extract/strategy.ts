import type { ExtractionStrategy, SourceType } from "../types.js";
import { SCREENSHOT } from "../constants.js";
import type { ExtractedImageMeta } from "../types.js";

export interface StrategyInput {
  focusTextLength: number;
  elementTypes: string[];
  images: ExtractedImageMeta[];
  hasCanvas: boolean;
  hasVideo: boolean;
  hasSvg: boolean;
  hasPdf: boolean;
  pdfTextLength: number;
  focusConfidence?: number;
  focusUncertain?: boolean;
  focusExtractionMethod?: string;
}

const VISUAL_TYPES = new Set([
  "image",
  "svg",
  "canvas",
  "video",
  "pdf",
  "figure",
]);

/**
 * Decide whether a screenshot crop is worth the token cost.
 */
export function needsVisualCapture(input: StrategyInput): boolean {
  if (input.focusUncertain || input.focusExtractionMethod === "visual-fallback") {
    return true;
  }
  if (
    typeof input.focusConfidence === "number" &&
    input.focusConfidence < 0.45
  ) {
    return true;
  }
  if (input.hasCanvas || input.hasVideo) return true;
  if (input.hasSvg) return true;
  if (input.hasPdf && input.pdfTextLength < SCREENSHOT.minVisualTextChars) {
    return true;
  }
  if (input.images.some((img) => img.isPartialSelection)) return true;
  if (
    input.elementTypes.some((t) => VISUAL_TYPES.has(t)) &&
    input.focusTextLength < SCREENSHOT.minVisualTextChars
  ) {
    return true;
  }
  if (
    input.elementTypes.includes("image") &&
    input.focusTextLength < SCREENSHOT.minVisualTextChars
  ) {
    return true;
  }
  return false;
}

export function resolveSourceType(elementTypes: string[]): SourceType {
  const visual = elementTypes.filter((t) => VISUAL_TYPES.has(t));
  if (visual.length === 0) return "webpage";
  if (visual.length === 1) {
    const t = visual[0];
    if (t === "image") return "image";
    if (t === "svg") return "svg";
    if (t === "canvas") return "canvas";
    if (t === "pdf") return "pdf";
    if (t === "video") return "mixed";
  }
  return "mixed";
}

export function resolveExtractionStrategy(
  input: StrategyInput,
  visualCaptured: boolean
): ExtractionStrategy {
  if (input.hasPdf) {
    if (input.pdfTextLength >= SCREENSHOT.minVisualTextChars) {
      return visualCaptured ? "pdf-visual-fallback" : "pdf-text";
    }
    return "pdf-visual-fallback";
  }
  if (visualCaptured && input.focusTextLength >= SCREENSHOT.minVisualTextChars) {
    return "visual-with-dom";
  }
  if (visualCaptured) return "visual-primary";
  if (input.focusTextLength >= SCREENSHOT.minVisualTextChars) {
    return "dom-with-context";
  }
  return "dom-text-only";
}
