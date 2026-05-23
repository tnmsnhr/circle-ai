import type { ExtractedContext, SelectionRect } from "./types.js";

/**
 * Payload shaped for the AI backend: explicit user selection vs background context.
 * The model should answer about `userSelection`, using `surroundingContext` only
 * to disambiguate (e.g. which product, which section).
 */
export interface AiSelectionPayload {
  /** System-style hint you can prepend to the chat system prompt. */
  instruction: string;
  userSelection: {
    /** Exact text inside the lasso bounding box. */
    text: string;
    elementTypes: string[];
    selectionRect: SelectionRect;
    /** JPEG base64 without data: URL prefix — only the boxed region. */
    cropImageBase64?: string;
    hasVisual: boolean;
  };
  surroundingContext: {
    nearbyText: string;
    ancestorText: string;
    headings: string[];
    captions: string[];
    links: ExtractedContext["context"]["links"];
    tableHeaders: string[];
    pageTitle: string;
    metaDescription?: string;
    h1?: string;
  };
  media: ExtractedContext["media"];
  page: {
    url: string;
    title: string;
    domain: string;
    sourceType: ExtractedContext["source"]["type"];
  };
  meta: {
    extractionStrategy: string;
    capturedAt: string;
    viewport: ExtractedContext["meta"]["viewport"];
  };
}

const AI_INSTRUCTION =
  "The user highlighted a specific region on the webpage. Answer about userSelection.text (and userSelection.cropImageBase64 if present). surroundingContext is background only—use it to disambiguate, not as the main subject unless the selection is empty or unclear.";

export function buildAiPayload(extracted: ExtractedContext): AiSelectionPayload {
  return {
    instruction: AI_INSTRUCTION,
    userSelection: {
      text: extracted.focus.text,
      elementTypes: extracted.focus.elementTypes,
      selectionRect: extracted.meta.selectionRect,
      cropImageBase64: extracted.focus.cropImageBase64,
      hasVisual: Boolean(extracted.focus.cropImageBase64),
    },
    surroundingContext: {
      nearbyText: extracted.context.nearbyText,
      ancestorText: extracted.context.ancestorText,
      headings: extracted.context.headings,
      captions: extracted.context.captions,
      links: extracted.context.links,
      tableHeaders: extracted.context.tableHeaders,
      pageTitle: extracted.context.pageTitle,
      metaDescription: extracted.context.metaDescription,
      h1: extracted.context.h1,
    },
    media: extracted.media,
    page: {
      url: extracted.source.url,
      title: extracted.source.title,
      domain: extracted.source.domain,
      sourceType: extracted.source.type,
    },
    meta: {
      extractionStrategy: extracted.meta.extractionStrategy,
      capturedAt: extracted.meta.capturedAt,
      viewport: extracted.meta.viewport,
    },
  };
}

/** Log payload for devtools without dumping megabytes of base64. */
export function logAiPayload(payload: AiSelectionPayload, selectionId?: string): void {
  const tag = selectionId
    ? `[syncle] AI payload (${selectionId.slice(0, 8)})`
    : "[syncle] AI payload";

  const summary = {
    instruction: payload.instruction,
    userSelection: {
      text: payload.userSelection.text,
      elementTypes: payload.userSelection.elementTypes,
      selectionRect: payload.userSelection.selectionRect,
      hasVisual: payload.userSelection.hasVisual,
      cropImageBase64: payload.userSelection.cropImageBase64
        ? `<JPEG base64, ${payload.userSelection.cropImageBase64.length} chars>`
        : undefined,
    },
    surroundingContext: payload.surroundingContext,
    media: {
      imageCount: payload.media.images?.length ?? 0,
      svgCount: payload.media.svg?.length ?? 0,
      hasPdf: Boolean(payload.media.pdf),
    },
    page: payload.page,
    meta: payload.meta,
  };

  console.group(tag);
  console.log("USER SELECTED (send this as the focus):", payload.userSelection.text);
  console.log("SURROUNDING CONTEXT (background only):", payload.surroundingContext);
  console.log("Full payload (image omitted):", summary);
  console.log("Raw payload for API:", payload);
  console.groupEnd();
}
