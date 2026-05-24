import type { ExtractedContext, Point2D, SelectionRect, ViewportMeta } from "./types.js";
import { SCREENSHOT } from "./constants.js";
import { getElementsIntersectingRect } from "./dom/elements.js";
import { extractFocusWithDetails } from "./extract/focus.js";
import { buildFocusExtractionContext } from "./focus/extractFocusCandidates.js";
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
import {
  buildSelectionEvidence,
  textForShapeClassification,
} from "./selectionEvidence/buildSelectionEvidence.js";
import { shouldIncludeCrop } from "./selectionEvidence/cropPolicy.js";
import { buildLocalContextBlock } from "./selectionEvidence/localContext.js";
import {
  classifySelectionShape,
  hasTableLikeElement,
  type SelectionShape,
} from "./selectionShape.js";
import type { SelectionTier } from "./constants.js";

export interface BuildExtractedContextOptions {
  /** Skip screenshot even if strategy would request it (debug). */
  skipVisual?: boolean;
  maxScreenshotWidth?: number;
  jpegQuality?: number;
  /** Freehand lasso points in client coordinates. */
  selectionPolygon?: Point2D[];
}

function resolveTierFromRect(rect: SelectionRect, textLen: number): SelectionTier {
  const area = rect.width * rect.height;
  if (area < 28_000 || textLen < 80) return "tiny";
  if (area > 120_000 || textLen > 800) return "large";
  return "medium";
}

function isMultiLineEvidence(
  evidence: import("./selectionEvidence/types.js").SelectionEvidence
): boolean {
  const tops = new Set(
    evidence.candidates
      .filter((c) => (c.type === "text-token" || c.type === "text-fragment") && c.rect)
      .map((c) => Math.round((c.rect!.top + c.rect!.height / 2) / 8))
  );
  return tops.size >= 2;
}

function buildFallbackContext(
  selectionRect: SelectionRect,
  options: BuildExtractedContextOptions,
  cause: unknown
): ExtractedContext {
  const message = cause instanceof Error ? cause.message : String(cause);
  console.error("[syncle] extraction fallback:", message);

  const elements = getElementsIntersectingRect(selectionRect);
  const elementTypes = detectElementTypes(elements);
  const surrounding = extractSurroundingContext(selectionRect, elements);

  const evidence = buildSelectionEvidence({
    ranked: [],
    ctx: buildFocusExtractionContext(selectionRect, options.selectionPolygon, elements),
    extracted: {
      source: {
        type: "webpage",
        url: location.href,
        title: document.title || "",
        domain: location.hostname || "",
      },
      focus: { text: "", elementTypes, uncertain: true },
      context: {
        nearbyText: surrounding.nearbyText,
        ancestorText: surrounding.ancestorText,
        headings: surrounding.headings,
        captions: surrounding.captions,
        links: surrounding.links,
        tableHeaders: surrounding.tableHeaders,
        pageTitle: surrounding.pageTitle,
        metaDescription: surrounding.metaDescription,
        h1: surrounding.h1,
      },
      media: { images: [] },
      meta: {
        selectionRect,
        selectionPolygon: options.selectionPolygon,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
          devicePixelRatio: window.devicePixelRatio || 1,
        },
        extractionStrategy: "visual-primary",
        capturedAt: new Date().toISOString(),
      },
    },
  });

  const extracted: ExtractedContext = {
    source: {
      type: resolveSourceType(elementTypes),
      url: location.href,
      title: document.title || "",
      domain: location.hostname || "",
    },
    focus: {
      text: "",
      elementTypes,
      confidence: 0.1,
      extractionMethod: "visual-fallback",
      uncertain: true,
    },
    context: {
      nearbyText: surrounding.nearbyText,
      ancestorText: surrounding.ancestorText,
      headings: surrounding.headings,
      captions: surrounding.captions,
      links: surrounding.links,
      tableHeaders: surrounding.tableHeaders,
      pageTitle: surrounding.pageTitle,
      metaDescription: surrounding.metaDescription,
      h1: surrounding.h1,
    },
    media: { images: [] },
    meta: {
      selectionRect,
      selectionPolygon: options.selectionPolygon,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio || 1,
      },
      extractionStrategy: "visual-primary",
      capturedAt: new Date().toISOString(),
    },
    selectionEvidence: evidence,
  };

  try {
    extracted.source.domain = new URL(extracted.source.url).hostname;
  } catch {
    /* keep hostname fallback */
  }

  extracted.aiPayload = buildAiPayload(extracted);
  return extracted;
}

/**
 * Main extraction pipeline: mechanical candidates + optional crop; AI resolves focus.
 */
export async function buildExtractedContext(
  selectionRect: SelectionRect,
  options: BuildExtractedContextOptions = {}
): Promise<ExtractedContext> {
  try {
    return await buildExtractedContextInner(selectionRect, options);
  } catch (err) {
    return buildFallbackContext(selectionRect, options, err);
  }
}

async function buildExtractedContextInner(
  selectionRect: SelectionRect,
  options: BuildExtractedContextOptions = {}
): Promise<ExtractedContext> {
  const elements = getElementsIntersectingRect(selectionRect);
  const elementTypes = detectElementTypes(elements);
  const focusResult = extractFocusWithDetails(
    selectionRect,
    elements,
    options.selectionPolygon
  );
  const ctx = buildFocusExtractionContext(
    selectionRect,
    options.selectionPolygon,
    elements
  );
  const surrounding = extractSurroundingContext(selectionRect, elements);
  const images = extractImages(elements, selectionRect);
  const svgs = extractSvgs(elements);
  const pdfHint = extractPdfHint(
    elements,
    focusResult.text,
    surrounding.nearbyText
  );

  const hasCanvas = elementTypes.includes("canvas");
  const hasVideo = elementTypes.includes("video");
  const hasSvg = elementTypes.includes("svg");
  const hasPdf = elementTypes.includes("pdf") || Boolean(pdfHint);
  const pdfTextLength =
    (pdfHint?.selectedText?.length || 0) + (pdfHint?.nearbyText?.length || 0);

  const draftExtracted: ExtractedContext = {
    source: {
      type: resolveSourceType(elementTypes),
      url: location.href,
      title: document.title || "",
      domain: "",
    },
    focus: {
      text: focusResult.text,
      elementTypes,
      confidence: focusResult.confidence,
      extractionMethod: focusResult.extractionMethod,
      uncertain: focusResult.uncertain,
    },
    context: {
      nearbyText: surrounding.nearbyText,
      ancestorText: surrounding.ancestorText,
      headings: surrounding.headings,
      captions: surrounding.captions,
      links: surrounding.links,
      tableHeaders: surrounding.tableHeaders,
      pageTitle: surrounding.pageTitle,
      metaDescription: surrounding.metaDescription,
      h1: surrounding.h1,
    },
    media: { images, svg: svgs.length ? svgs : undefined, pdf: pdfHint },
    meta: {
      selectionRect,
      selectionPolygon: options.selectionPolygon,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio || 1,
      },
      extractionStrategy: "dom-with-context",
      capturedAt: new Date().toISOString(),
    },
  };

  try {
    draftExtracted.source.domain = new URL(draftExtracted.source.url).hostname;
  } catch {
    draftExtracted.source.domain = location.hostname || "";
  }

  let evidence = buildSelectionEvidence({
    ranked: focusResult.candidates ?? [],
    ctx,
    extracted: draftExtracted,
  });

  const tier = resolveTierFromRect(
    selectionRect,
    textForShapeClassification(evidence).length
  );

  let selectionShape: SelectionShape = classifySelectionShape({
    text: textForShapeClassification(evidence),
    elementTypes,
    hasVisual: evidence.hasVisual,
    hasTableContext: hasTableLikeElement(elementTypes),
    isMultiLine: isMultiLineEvidence(evidence),
  });

  const localContextBlock = buildLocalContextBlock(
    draftExtracted,
    tier,
    selectionShape
  );
  evidence = { ...evidence, localContextBlock };

  const strategyInput = {
    focusTextLength: textForShapeClassification(evidence).length,
    elementTypes,
    images,
    hasCanvas,
    hasVideo,
    hasSvg,
    hasPdf,
    pdfTextLength,
    focusConfidence: evidence.evidenceConfidence,
    focusUncertain: evidence.evidenceConfidence < 0.55,
    focusExtractionMethod: focusResult.extractionMethod,
  };

  const wantCrop =
    !options.skipVisual &&
    (shouldIncludeCrop(evidence, draftExtracted, selectionShape) ||
      needsVisualCapture(strategyInput));

  let cropImageBase64: string | undefined;
  if (wantCrop) {
    cropImageBase64 = await requestCroppedScreenshot(selectionRect, {
      maxWidth: options.maxScreenshotWidth ?? SCREENSHOT.maxWidth,
      quality: options.jpegQuality ?? SCREENSHOT.jpegQuality,
    });
  }

  if (cropImageBase64) {
    evidence = buildSelectionEvidence({
      ranked: focusResult.candidates ?? [],
      ctx,
      extracted: draftExtracted,
      cropImageBase64,
    });
    evidence = { ...evidence, localContextBlock };
    selectionShape = classifySelectionShape({
      text: textForShapeClassification(evidence),
      elementTypes,
      hasVisual: true,
      hasTableContext: hasTableLikeElement(elementTypes),
      isMultiLine: isMultiLineEvidence(evidence),
    });
  }

  const extractionStrategy = resolveExtractionStrategy(
    strategyInput,
    Boolean(cropImageBase64)
  );

  let extractionMethod = focusResult.extractionMethod;
  if (cropImageBase64 && evidence.evidenceConfidence < 0.5 && !evidence.extractedText?.trim()) {
    extractionMethod = "media-crop";
  }

  const extracted: ExtractedContext = {
    ...draftExtracted,
    focus: {
      text: evidence.extractedText ?? focusResult.text,
      cropImageBase64,
      elementTypes,
      confidence: evidence.evidenceConfidence,
      extractionMethod,
      uncertain: evidence.evidenceConfidence < 0.75,
    },
    meta: {
      ...draftExtracted.meta,
      extractionStrategy,
    },
    selectionEvidence: evidence,
  };

  extracted.aiPayload = buildAiPayload(extracted);
  return extracted;
}

/** Convenience: build from lasso polygon client points. */
export async function buildExtractedContextFromPoints(
  points: Array<{ x: number; y: number }>,
  options?: BuildExtractedContextOptions
): Promise<ExtractedContext> {
  const rect = rectFromPoints(points);
  return buildExtractedContext(rect, {
    ...options,
    selectionPolygon: points.length >= 3 ? points : options?.selectionPolygon,
  });
}
