export type {
  ExtractedContext,
  SelectionRect,
  ViewportMeta,
  SourceType,
  ExtractionStrategy,
  CaptureCropRequest,
  CaptureCropResponse,
} from "./types.js";

export { SCREENSHOT, MSG } from "./constants.js";
export {
  buildExtractedContext,
  buildExtractedContextFromPoints,
} from "./buildExtractedContext.js";
export { buildAiPayload, logAiPayload } from "./buildAiPayload.js";
export type { AiSelectionPayload } from "./buildAiPayload.js";
export { rectFromPoints, normalizeRect } from "./geometry/rect.js";
export { requestCroppedScreenshot } from "./screenshot/captureClient.js";
