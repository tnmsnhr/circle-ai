import type { ExtractedContext, SelectionRect } from "./types.js";
import type { SelectionEvidence } from "./selectionEvidence/types.js";

export interface AiSelectionPayload {
  instruction: string;
  selectionEvidence?: SelectionEvidence;
  selectionShape: "visual_selection";
  userSelection: {
    text: string;
    elementTypes: string[];
    selectionRect: SelectionRect;
    cropImageBase64?: string;
    hasVisual: boolean;
  };
  page: {
    url: string;
    title: string;
    domain: string;
    sourceType: ExtractedContext["source"]["type"];
  };
  pageContext: {
    pageTitle: string;
    metaDescription?: string;
    h1?: string;
  };
  meta: {
    extractionStrategy: string;
    capturedAt: string;
    viewport: ExtractedContext["meta"]["viewport"];
    evidenceConfidence?: number;
  };
}

const AI_INSTRUCTION =
  "The user lasso-selected a region on the page. Use the attached crop image as the primary source of truth for what they selected. Use page metadata only as background context.";

export function buildAiPayload(extracted: ExtractedContext): AiSelectionPayload {
  const evidence = extracted.selectionEvidence;
  return {
    instruction: AI_INSTRUCTION,
    selectionEvidence: evidence,
    selectionShape: "visual_selection",
    userSelection: {
      text: "",
      elementTypes: [],
      selectionRect: extracted.meta.selectionRect,
      cropImageBase64: evidence?.cropImageBase64 ?? extracted.focus.cropImageBase64,
      hasVisual: Boolean(evidence?.hasVisual ?? extracted.focus.cropImageBase64),
    },
    page: {
      url: extracted.source.url,
      title: extracted.source.title,
      domain: extracted.source.domain,
      sourceType: extracted.source.type,
    },
    pageContext: {
      pageTitle: extracted.context.pageTitle,
      metaDescription: extracted.context.metaDescription,
      h1: extracted.context.h1,
    },
    meta: {
      extractionStrategy: extracted.meta.extractionStrategy,
      capturedAt: extracted.meta.capturedAt,
      viewport: extracted.meta.viewport,
      evidenceConfidence: evidence?.evidenceConfidence,
    },
  };
}

export function logAiPayload(
  payload: AiSelectionPayload,
  selectionId?: string
): void {
  const label = selectionId
    ? `[syncle] AI payload · ${selectionId.slice(0, 8)}`
    : "[syncle] AI payload";

  console.log(label, {
    instruction: payload.instruction,
    selectionShape: payload.selectionShape,
    hasVisual: payload.userSelection.hasVisual,
    cropImageBase64: payload.userSelection.cropImageBase64
      ? `<JPEG base64, ${payload.userSelection.cropImageBase64.length} chars>`
      : undefined,
    page: payload.page,
    pageContext: payload.pageContext,
    meta: payload.meta,
  });
}
