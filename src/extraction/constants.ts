/** Character limits for token/cost control. */
export const LIMITS = {
  focusText: 4000,
  nearbyText: 2800,
  ancestorText: 1400,
  svgOuterHtml: 4000,
  svgText: 2000,
  maxLinks: 12,
  maxHeadings: 8,
  maxCaptions: 6,
  maxImages: 6,
  maxSvgs: 3,
} as const;

/** Expand selection for surrounding context (CSS px). */
export const CONTEXT_EXPAND_PX = 320;

/** Screenshot crop defaults. */
export const SCREENSHOT = {
  maxWidth: 1280,
  jpegQuality: 0.82,
  minVisualTextChars: 48,
  partialImageAreaRatio: 0.85,
} as const;

/** Message types for MV3 extension messaging. */
export const MSG = {
  CAPTURE_CROP: "EXTRACTION_CAPTURE_CROP",
  OFFSCREEN_CROP_RECT: "OFFSCREEN_CROP_RECT",
} as const;
