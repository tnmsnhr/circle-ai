import type { ExtractedContext, SelectionRect, ViewportMeta } from "./types.js";
import { LIMITS, SCREENSHOT } from "./constants.js";
import { getElementsIntersectingRect } from "./dom/elements.js";
import { extractFocusText } from "./extract/focus.js";
import { extractSurroundingContext } from "./extract/context.js";
import {
  detectElementTypes,
  extractImages,
  extractPdfHint,
  extractSvgs,
} from "./extract/media.js";
import {
  needsVisualCapture,
  resolveExtractionStrategy,
  resolveSourceType,
} from "./extract/strategy.js";
import { rectFromPoints } from "./geometry/rect.js";
import { requestCroppedScreenshot } from "./screenshot/captureClient.js";
import { buildAiPayload } from "./buildAiPayload.js";

export interface BuildExtractedContextOptions {
  /** Skip screenshot even if strategy would request it (debug). */
  skipVisual?: boolean;
  maxScreenshotWidth?: number;
  jpegQuality?: number;
}

/**
 * Main extraction pipeline: DOM-first text + context, visual fallback when needed.
 * Call from the content script after the user finishes a lasso/rect selection.
 */
export async function buildExtractedContext(
  selectionRect: SelectionRect,
  options: BuildExtractedContextOptions = {}
): Promise<ExtractedContext> {
  const elements = getElementsIntersectingRect(selectionRect);
  const elementTypes = detectElementTypes(elements);
  const focusText = extractFocusText(selectionRect, elements);
  const ctx = extractSurroundingContext(selectionRect, elements);
  const images = extractImages(elements, selectionRect);
  const svgs = extractSvgs(elements);
  const pdfHint = extractPdfHint(elements, focusText, ctx.nearbyText);

  const hasCanvas = elementTypes.includes("canvas");
  const hasVideo = elementTypes.includes("video");
  const hasSvg = elementTypes.includes("svg");
  const hasPdf = elementTypes.includes("pdf") || Boolean(pdfHint);
  const pdfTextLength =
    (pdfHint?.selectedText?.length || 0) + (pdfHint?.nearbyText?.length || 0);

  const strategyInput = {
    focusTextLength: focusText.length,
    elementTypes,
    images,
    hasCanvas,
    hasVideo,
    hasSvg,
    hasPdf,
    pdfTextLength,
  };

  const wantVisual =
    !options.skipVisual && needsVisualCapture(strategyInput);

  let cropImageBase64: string | undefined;
  if (wantVisual) {
    cropImageBase64 = await requestCroppedScreenshot(selectionRect, {
      maxWidth: options.maxScreenshotWidth ?? SCREENSHOT.maxWidth,
      quality: options.jpegQuality ?? SCREENSHOT.jpegQuality,
    });
  }

  const extractionStrategy = resolveExtractionStrategy(
    strategyInput,
    Boolean(cropImageBase64)
  );
  const sourceType = resolveSourceType(elementTypes);

  const viewport: ViewportMeta = {
    width: window.innerWidth,
    height: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio || 1,
  };

  const url = location.href;
  let domain = "";
  try {
    domain = new URL(url).hostname;
  } catch {
    domain = location.hostname || "";
  }

  const extracted: ExtractedContext = {
    source: {
      type: sourceType,
      url,
      title: document.title || "",
      domain,
    },
    focus: {
      text: focusText,
      cropImageBase64,
      elementTypes,
    },
    context: {
      nearbyText: ctx.nearbyText,
      ancestorText: ctx.ancestorText,
      headings: ctx.headings,
      captions: ctx.captions,
      links: ctx.links,
      tableHeaders: ctx.tableHeaders,
      pageTitle: ctx.pageTitle,
      metaDescription: ctx.metaDescription,
      h1: ctx.h1,
    },
    media: {
      images,
      svg: svgs.length ? svgs : undefined,
      pdf: pdfHint,
    },
    meta: {
      selectionRect,
      viewport,
      extractionStrategy,
      capturedAt: new Date().toISOString(),
    },
  };

  extracted.aiPayload = buildAiPayload(extracted);

  return extracted;
}

/** Convenience: build from lasso polygon client points. */
export async function buildExtractedContextFromPoints(
  points: Array<{ x: number; y: number }>,
  options?: BuildExtractedContextOptions
): Promise<ExtractedContext> {
  return buildExtractedContext(rectFromPoints(points), options);
}
