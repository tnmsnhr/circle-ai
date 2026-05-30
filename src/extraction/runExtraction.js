/**
 * Thin JS bridge so OverlayApp (JSX) can call the TS pipeline without type friction.
 */
import {
  buildExtractedContextFromPoints,
  buildLocalExtractedContextFromPoints,
} from "./buildExtractedContext.ts";
import { logLocalExtraction } from "./logLocalExtraction.js";
import { ensureContextRegistered } from "../api/registerContext.js";
import { CLOUD_SYNC_ENABLED } from "../config/features.js";

/**
 * @param {Array<{ x: number, y: number }>} clientPoints
 * @param {string} [selectionId]
 * @param {(result: import('../api/registerContext.js').RegisterContextResult) => void} [onRegisterUpdate]
 * @param {{ aiEnabled?: boolean }} [options]
 * @returns {Promise<import('./types').ExtractedContext>}
 */
export function runSelectionExtraction(
  clientPoints,
  selectionId,
  onRegisterUpdate,
  options = {}
) {
  const aiEnabled = options.aiEnabled !== false;

  if (!aiEnabled) {
    return buildLocalExtractedContextFromPoints(clientPoints)
      .then((extracted) => {
        logLocalExtraction(extracted, selectionId);
        onRegisterUpdate?.({ ok: false, reason: "local_only", skipped: true });
        return extracted;
      })
      .catch((err) => {
        console.error("[syncle] local extraction failed:", err);
        throw err;
      });
  }

  return buildExtractedContextFromPoints(clientPoints)
    .then(async (extracted) => {
      try {
        if (selectionId) {
          console.info(
            "[syncle] selection captured",
            selectionId.slice(0, 8),
            extracted.focus.cropImageBase64 ? "with crop" : "no crop"
          );
        }

        if (selectionId && CLOUD_SYNC_ENABLED) {
          try {
            const result = await ensureContextRegistered(extracted, selectionId);
            if (result.ok) {
              extracted.optimizedPayload = result.optimizedPayload;
              extracted.contextIds = {
                pageContextId: result.pageContextId,
                selectionContextId: result.selectionContextId,
              };
              console.info(
                "[syncle] registered context",
                result.pageContextId,
                result.selectionContextId
              );
            } else {
              console.warn("[syncle] context register:", result);
            }
            onRegisterUpdate?.(result);
          } catch (err) {
            const message =
              err instanceof Error ? err.message : "Registration failed";
            console.warn("[syncle] context register error:", err);
            onRegisterUpdate?.({ ok: false, reason: "error", message });
          }
        }
      } catch (err) {
        console.warn("[syncle] post-extract error:", err);
      }

      return extracted;
    })
    .catch((err) => {
      console.error("[syncle] extraction pipeline failed:", err);
      throw err;
    });
}
