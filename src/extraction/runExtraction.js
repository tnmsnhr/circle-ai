/**
 * Thin JS bridge so OverlayApp (JSX) can call the TS pipeline without type friction.
 */
import { buildExtractedContextFromPoints } from "./buildExtractedContext.ts";
import { logAiPayload } from "./buildAiPayload.ts";
import { registerExtractedContext } from "../api/registerContext.js";

/**
 * @param {Array<{ x: number, y: number }>} clientPoints
 * @param {string} [selectionId]
 * @returns {Promise<import('./types').ExtractedContext>}
 */
export function runSelectionExtraction(clientPoints, selectionId) {
  return buildExtractedContextFromPoints(clientPoints).then(async (extracted) => {
    if (extracted.aiPayload) {
      logAiPayload(extracted.aiPayload, selectionId);
    }

    if (selectionId) {
      try {
        const registered = await registerExtractedContext(extracted, selectionId);
        if (registered) {
          extracted.optimizedPayload = registered.optimizedPayload;
          extracted.contextIds = {
            pageContextId: registered.pageContextId,
            selectionContextId: registered.selectionContextId,
          };
          console.info(
            "[syncle] registered context",
            registered.pageContextId,
            registered.selectionContextId
          );
        }
      } catch (err) {
        console.warn("[syncle] context register failed:", err);
      }
    }

    return extracted;
  });
}
