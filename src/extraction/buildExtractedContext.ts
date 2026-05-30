import type { ExtractedContext, Point2D } from "./types.js";
import { SCREENSHOT } from "./constants.js";
import { rectFromPoints } from "./geometry/rect.js";
import { requestCroppedScreenshot } from "./screenshot/captureClient.js";
import { extractLocalFromRect } from "./extractLocalFromRect.js";
import type { SelectionEvidence } from "./selectionEvidence/types.js";

export interface BuildExtractedContextOptions {
  selectionPolygon?: Point2D[];
}

function readPageMeta() {
  const h1 = document.querySelector("h1")?.textContent?.trim() ?? "";
  const metaDescription =
    document
      .querySelector('meta[name="description"]')
      ?.getAttribute("content")
      ?.trim() ||
    document
      .querySelector('meta[property="og:description"]')
      ?.getAttribute("content")
      ?.trim() ||
    "";
  return {
    pageTitle: document.title || "",
    h1,
    metaDescription,
  };
}

function buildVisualEvidence(cropImageBase64?: string): SelectionEvidence {
  return {
    candidates: [],
    cropImageBase64,
    hasVisual: Boolean(cropImageBase64),
    evidenceConfidence: cropImageBase64 ? 0.9 : 0.1,
  };
}

export async function buildExtractedContextFromPoints(
  clientPoints: Array<{ x: number; y: number }>,
  options: BuildExtractedContextOptions = {}
): Promise<ExtractedContext> {
  const selectionRect = rectFromPoints(clientPoints);
  const pageMeta = readPageMeta();

  const cropImageBase64 = await requestCroppedScreenshot(selectionRect, {
    maxWidth: SCREENSHOT.maxWidth,
    quality: SCREENSHOT.jpegQuality,
  });

  const evidence = buildVisualEvidence(cropImageBase64);
  const extracted: ExtractedContext = {
    source: {
      type: "webpage",
      url: location.href,
      title: pageMeta.pageTitle,
      domain: location.hostname || "",
    },
    focus: {
      text: "",
      cropImageBase64,
      elementTypes: [],
      extractionMethod: cropImageBase64 ? "media-crop" : "visual-fallback",
      uncertain: !cropImageBase64,
    },
    context: {
      pageTitle: pageMeta.pageTitle,
      metaDescription: pageMeta.metaDescription || undefined,
      h1: pageMeta.h1 || undefined,
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

  return extracted;
}

/** Local-only: DOM text in lasso rect + page meta. No screenshot, no backend. */
export async function buildLocalExtractedContextFromPoints(
  clientPoints: Array<{ x: number; y: number }>,
  options: BuildExtractedContextOptions = {}
): Promise<ExtractedContext & { localDom: ReturnType<typeof extractLocalFromRect> }> {
  const selectionRect = rectFromPoints(clientPoints);
  const pageMeta = readPageMeta();
  const localDom = extractLocalFromRect(selectionRect);

  const evidence: SelectionEvidence = {
    candidates: [],
    hasVisual: false,
    evidenceConfidence: localDom.selectedText.trim() ? 0.85 : 0.2,
  };

  return {
    source: {
      type: "webpage",
      url: location.href,
      title: pageMeta.pageTitle,
      domain: location.hostname || "",
    },
    focus: {
      text: localDom.textSnippet,
      elementTypes: localDom.elementTags,
      extractionMethod: "visual-fallback",
      uncertain: !localDom.selectedText.trim(),
    },
    context: {
      pageTitle: pageMeta.pageTitle,
      metaDescription: pageMeta.metaDescription || undefined,
      h1: pageMeta.h1 || undefined,
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
    localDom,
  };
}
