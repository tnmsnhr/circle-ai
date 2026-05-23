/**
 * Thin JS bridge so OverlayApp (JSX) can call the TS pipeline without type friction.
 */
import { buildExtractedContextFromPoints } from "./buildExtractedContext.ts";

/**
 * @param {Array<{ x: number, y: number }>} clientPoints
 * @returns {Promise<import('./types').ExtractedContext>}
 */
export function runSelectionExtraction(clientPoints) {
  return buildExtractedContextFromPoints(clientPoints);
}
