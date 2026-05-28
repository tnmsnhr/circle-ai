import type { ExtractedContext } from "./types.js";
import {
  EXTRACTOR_VERSION,
  SCHEMA_VERSION,
  type SelectionTier,
} from "./constants.js";
import { buildPageContext } from "./pageContext/buildPageContext.js";
import { buildCanonicalUrl } from "./pageContext/canonicalUrl.js";
import {
  buildContextLens,
  type ContextLens,
  type SelectionShape,
} from "./selectionShape.js";
import type { SelectionEvidence } from "./selectionEvidence/types.js";

export type { SelectionShape, ContextLens, SelectionEvidence };

export interface SelectionPayloadBody {
  localPinId: string;
  selectionShape: SelectionShape;
  selectionEvidence: SelectionEvidence;
  contextLens?: ContextLens;
  meta: {
    extractionStrategy: string;
    selectionTier: SelectionTier;
    estimatedTextTokens: number;
    estimatedImageBytes?: number;
    hasImage: boolean;
    selectionShape: SelectionShape;
    elementTypes: string[];
    evidenceConfidence?: number;
    focusExtractionMethod?: string;
  };
}

export interface OptimizedAiPayloadFirstPin {
  schemaVersion: string;
  extractorVersion: string;
  kind: "selection_with_page_context";
  pageFingerprint: string;
  canonicalUrl: string;
  pageContext: ReturnType<typeof buildPageContext>;
  selection: SelectionPayloadBody;
}

export interface OptimizedAiPayloadPin {
  schemaVersion: string;
  extractorVersion: string;
  kind: "selection_only";
  pageContextId: string;
  pageFingerprint: string;
  selection: SelectionPayloadBody;
}

export type OptimizedAiPayload =
  | OptimizedAiPayloadFirstPin
  | OptimizedAiPayloadPin;

function resolveTier(rect: ExtractedContext["meta"]["selectionRect"]): SelectionTier {
  const area = rect.width * rect.height;
  if (area < 28_000) return "tiny";
  if (area > 120_000) return "large";
  return "medium";
}

function buildSelectionBody(
  extracted: ExtractedContext,
  localPinId: string
): SelectionPayloadBody {
  const evidence = extracted.selectionEvidence;
  if (!evidence) {
    throw new Error("selectionEvidence required before optimizeForAi");
  }

  const hasCrop = Boolean(evidence.cropImageBase64);
  const selectionShape: SelectionShape = "visual_selection";

  return {
    localPinId,
    selectionShape,
    selectionEvidence: evidence,
    contextLens: buildContextLens(extracted),
    meta: {
      extractionStrategy: extracted.meta.extractionStrategy,
      selectionTier: resolveTier(extracted.meta.selectionRect),
      estimatedTextTokens: 0,
      estimatedImageBytes: hasCrop
        ? Math.round((evidence.cropImageBase64!.length * 3) / 4)
        : undefined,
      hasImage: hasCrop,
      selectionShape,
      elementTypes: [],
      evidenceConfidence: evidence.evidenceConfidence,
      focusExtractionMethod: extracted.focus.extractionMethod,
    },
  };
}

export function optimizeForAi(
  extracted: ExtractedContext,
  options: {
    localPinId: string;
    pageFingerprint: string;
    pageContextId?: string;
  }
): OptimizedAiPayload {
  const selection = buildSelectionBody(extracted, options.localPinId);
  const canonicalUrl = buildCanonicalUrl(extracted.source.url);

  if (options.pageContextId) {
    return {
      schemaVersion: SCHEMA_VERSION,
      extractorVersion: EXTRACTOR_VERSION,
      kind: "selection_only",
      pageContextId: options.pageContextId,
      pageFingerprint: options.pageFingerprint,
      selection,
    };
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    extractorVersion: EXTRACTOR_VERSION,
    kind: "selection_with_page_context",
    pageFingerprint: options.pageFingerprint,
    canonicalUrl,
    pageContext: buildPageContext(extracted),
    selection,
  };
}
