/** Payload contract versions (see token-optimized plan). */
export const SCHEMA_VERSION = "1";
export const EXTRACTOR_VERSION = "2.0.0";

/** Session cache TTL (extension chrome.storage.session). */
export const PAGE_CONTEXT_TTL_MS = 30 * 60 * 1000; // 30 min idle
export const SELECTION_CONTEXT_TTL_MS = 24 * 60 * 60 * 1000; // 24h

export type SelectionTier = "tiny" | "medium" | "large";

/** Screenshot crop defaults. */
export const SCREENSHOT = {
  maxWidth: 1280,
  jpegQuality: 0.82,
} as const;

/** Message types for MV3 extension messaging. */
export const MSG = {
  CAPTURE_CROP: "EXTRACTION_CAPTURE_CROP",
  OFFSCREEN_CROP_RECT: "OFFSCREEN_CROP_RECT",
} as const;
