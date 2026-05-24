import type { ExtractedContext, SelectionRect } from "./types.js";

/**
 * Debug-oriented payload mirroring what the backend receives.
 * Full ExtractedContext remains debug-only in the panel.
 */
export interface AiSelectionPayload {
  instruction: string;
  selectionEvidence?: ExtractedContext["selectionEvidence"];
  selectionShape?: string;
  userSelection: {
    /** Debug hint only — AI resolves from candidates. */
    text: string;
    elementTypes: string[];
    selectionRect: SelectionRect;
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
    evidenceConfidence?: number;
  };
}

const AI_INSTRUCTION =
  "The browser sent mechanical selection evidence (candidates ranked by visual proximity, not semantic importance). Resolve which candidate the user intended using candidates, local context, crop, and page context. Do not treat focus.text as authoritative.";

export function buildAiPayload(extracted: ExtractedContext): AiSelectionPayload {
  const evidence = extracted.selectionEvidence;
  return {
    instruction: AI_INSTRUCTION,
    selectionEvidence: evidence,
    userSelection: {
      text: evidence?.extractedText ?? extracted.focus.text,
      elementTypes: extracted.focus.elementTypes,
      selectionRect: extracted.meta.selectionRect,
      cropImageBase64: evidence?.cropImageBase64 ?? extracted.focus.cropImageBase64,
      hasVisual: Boolean(evidence?.hasVisual ?? extracted.focus.cropImageBase64),
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

  const forConsole = {
    instruction: payload.instruction,
    selectionEvidence: payload.selectionEvidence
      ? {
          ...payload.selectionEvidence,
          cropImageBase64: payload.selectionEvidence.cropImageBase64
            ? `<JPEG base64, ${payload.selectionEvidence.cropImageBase64.length} chars>`
            : undefined,
          candidates: payload.selectionEvidence.candidates?.map((c) => ({
            type: c.type,
            text: c.text?.slice(0, 80),
            visualWeight: c.visualWeight,
            signals: c.signals,
          })),
        }
      : undefined,
    userSelection: {
      ...payload.userSelection,
      cropImageBase64: payload.userSelection.cropImageBase64
        ? `<JPEG base64, ${payload.userSelection.cropImageBase64.length} chars>`
        : undefined,
    },
    meta: payload.meta,
  };

  console.log(label, forConsole);
}
