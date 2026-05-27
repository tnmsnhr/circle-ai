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
  classifySelectionShape,
  hasTableLikeElement,
  type ContextLens,
  type SelectionShape,
} from "./selectionShape.js";
import type {
  SelectionEvidence,
  SelectionSubType,
} from "./selectionEvidence/types.js";
import { textForShapeClassification } from "./selectionEvidence/buildSelectionEvidence.js";
import { logSelectionEvidence } from "./selectionEvidence/logSelectionEvidence.js";

export type { SelectionShape, ContextLens, SelectionEvidence };

export interface SelectionPayloadBody {
  localPinId: string;
  selectionShape: SelectionShape;
  selectionSubType?: SelectionSubType;
  selectionEvidence: SelectionEvidence;
  contextLens?: ContextLens;
  meta: {
    extractionStrategy: string;
    selectionTier: SelectionTier;
    estimatedTextTokens: number;
    estimatedImageBytes?: number;
    cropWidth?: number;
    cropHeight?: number;
    hasImage: boolean;
    selectionShape: SelectionShape;
    selectionSubType?: SelectionSubType;
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

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function resolveTier(extracted: ExtractedContext): SelectionTier {
  const area =
    extracted.meta.selectionRect.width * extracted.meta.selectionRect.height;
  const evidence = extracted.selectionEvidence;
  const textLen =
    evidence?.extractedText?.length ??
    evidence?.candidates?.[0]?.text?.length ??
    extracted.focus.text.length;
  if (area < 28_000 || textLen < 80) return "tiny";
  if (area > 120_000 || textLen > 800) return "large";
  return "medium";
}

function isMultiLineEvidence(evidence: SelectionEvidence): boolean {
  const lineFrags = evidence.candidates.filter(
    (c) =>
      c.type === "text-fragment" &&
      (c.signals.includes("line-fragment") ||
        c.signals.includes("multi-line-fragment"))
  );
  if (lineFrags.length >= 2) return true;
  const tops = new Set(
    evidence.candidates
      .filter((c) => c.type === "text-token" && c.rect)
      .map((c) => Math.round((c.rect!.top + c.rect!.height / 2) / 8))
  );
  return tops.size >= 2;
}

function buildSelectionBody(
  extracted: ExtractedContext,
  localPinId: string
): SelectionPayloadBody {
  const evidence = extracted.selectionEvidence;
  if (!evidence) {
    throw new Error("buildExtractedContext must attach selectionEvidence before optimizeForAi");
  }

  const tier = resolveTier(extracted);
  const elementTypes = extracted.focus.elementTypes;
  const shapeText = textForShapeClassification(evidence);
  const hasCrop = Boolean(evidence.cropImageBase64);
  const multiLine = isMultiLineEvidence(evidence);

  let selectionShape = classifySelectionShape({
    text: shapeText,
    elementTypes,
    hasVisual: evidence.hasVisual || hasCrop,
    hasTableContext: hasTableLikeElement(elementTypes),
    isMultiLine: multiLine,
    isStructuredRegion: evidence.isStructuredRegion,
    isLargeCodeBlock: evidence.isLargeCodeBlock,
    isSectionHeading: evidence.isSectionHeading,
  });

  if (
    evidence.evidenceConfidence < 0.45 &&
    hasCrop &&
    selectionShape === "short_inline_selection"
  ) {
    selectionShape = shapeText.trim() ? "mixed_selection" : "visual_selection";
  }

  const contextLens = buildContextLens(extracted);
  const tokenEstimate = estimateTokens(
    shapeText +
      (evidence.localContextBlock ?? "") +
      evidence.candidates.map((c) => c.text ?? "").join(" ")
  );

  const body: SelectionPayloadBody = {
    localPinId,
    selectionShape,
    selectionSubType: evidence.selectionSubType,
    selectionEvidence: evidence,
    contextLens,
    meta: {
      extractionStrategy: extracted.meta.extractionStrategy,
      selectionTier: tier,
      estimatedTextTokens: tokenEstimate,
      estimatedImageBytes: hasCrop
        ? Math.round((evidence.cropImageBase64!.length * 3) / 4)
        : undefined,
      hasImage: hasCrop,
      selectionShape,
      selectionSubType: evidence.selectionSubType,
      elementTypes,
      evidenceConfidence: evidence.evidenceConfidence,
      focusExtractionMethod: extracted.focus.extractionMethod,
    },
  };

  const payloadBytes = JSON.stringify(body).length;
  logSelectionEvidence(evidence, {
    selectionShape,
    localContextLen: evidence.localContextBlock?.length ?? 0,
    payloadJsonBytes: payloadBytes,
    selectionId: localPinId,
  });

  return body;
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
