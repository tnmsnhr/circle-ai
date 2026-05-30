/**
 * Pretty-print local extraction payload to the page DevTools console.
 * @param {object} payload
 * @param {string} [selectionId]
 */
export function logLocalExtraction(payload, selectionId) {
  const label = selectionId
    ? `[syncle] local extraction · ${selectionId.slice(0, 8)}`
    : "[syncle] local extraction";

  console.group(label);
  console.log("mode", "local-only (no backend / no OpenAI)");
  console.log("page", payload.source);
  console.log("pageMeta", payload.context);
  console.log("selectionRect", payload.meta?.selectionRect);
  console.log("localDom", payload.localDom);
  if (payload.selectionEvidence) {
    console.log("evidence", {
      ...payload.selectionEvidence,
      cropImageBase64: payload.selectionEvidence.cropImageBase64
        ? `<JPEG ${payload.selectionEvidence.cropImageBase64.length} chars>`
        : undefined,
    });
  }
  console.log("full payload", payload);
  console.groupEnd();
}
