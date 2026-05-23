import type { ExtractedContext } from "./types.js";
import {
  EXTRACTOR_VERSION,
  SCHEMA_VERSION,
  type SelectionTier,
} from "./constants.js";
import { buildPageContext } from "./pageContext/buildPageContext.js";
import { buildCanonicalUrl } from "./pageContext/canonicalUrl.js";

export interface SelectedMediaMeta {
  type: "image" | "svg" | "canvas" | "video" | "pdf";
  alt?: string;
  title?: string;
  caption?: string;
  isPartialSelection?: boolean;
}

export interface SelectionPayloadBody {
  localPinId: string;
  userSelection: {
    text: string;
    elementTypes: string[];
  };
  localContextBlock?: string;
  selectedMedia?: SelectedMediaMeta[];
  cropImageBase64?: string;
  meta: {
    extractionStrategy: string;
    selectionTier: SelectionTier;
    estimatedTextTokens: number;
    estimatedImageBytes?: number;
    cropWidth?: number;
    cropHeight?: number;
    hasImage: boolean;
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
  const focusLen = extracted.focus.text.length;
  if (area < 28_000 || focusLen < 80) return "tiny";
  if (area > 120_000 || focusLen > 800) return "large";
  return "medium";
}

function isTinyVisual(extracted: ExtractedContext, tier: SelectionTier): boolean {
  if (tier !== "tiny") return false;
  const types = extracted.focus.elementTypes;
  return (
    types.includes("image") ||
    types.includes("canvas") ||
    types.includes("video") ||
    types.includes("svg") ||
    extracted.media.images.some((img) => img.isPartialSelection)
  );
}

function buildLocalContextBlock(
  extracted: ExtractedContext,
  tier: SelectionTier
): string {
  const effectiveTier = isTinyVisual(extracted, tier) ? "medium" : tier;
  const caps: Record<SelectionTier, number> = {
    tiny: 900,
    medium: 1800,
    large: 3500,
  };
  const max = caps[effectiveTier];
  const parts: string[] = [];
  if (extracted.context.headings.length) {
    parts.push(extracted.context.headings.map((h) => `[Heading] ${h}`).join("\n"));
  }
  if (extracted.context.captions.length) {
    parts.push(extracted.context.captions.join("\n"));
  }
  if (extracted.context.nearbyText) {
    parts.push(extracted.context.nearbyText);
  }
  const block = parts.join("\n\n").trim();
  return block.length <= max ? block : `${block.slice(0, max)}…`;
}

function buildSelectedMedia(extracted: ExtractedContext): SelectedMediaMeta[] {
  const out: SelectedMediaMeta[] = [];
  for (const img of extracted.media.images.slice(0, 3)) {
    out.push({
      type: "image",
      alt: img.alt || undefined,
      title: img.title || undefined,
      caption: img.figcaption,
      isPartialSelection: img.isPartialSelection,
    });
  }
  if (extracted.focus.elementTypes.includes("video")) {
    out.push({ type: "video" });
  }
  if (extracted.focus.elementTypes.includes("canvas")) {
    out.push({ type: "canvas" });
  }
  if (extracted.focus.elementTypes.includes("svg")) {
    out.push({ type: "svg" });
  }
  return out;
}

function buildSelectionBody(
  extracted: ExtractedContext,
  localPinId: string
): SelectionPayloadBody {
  const tier = resolveTier(extracted);
  const localContextBlock = buildLocalContextBlock(extracted, tier);
  const text = extracted.focus.text;
  const crop = extracted.focus.cropImageBase64;

  return {
    localPinId,
    userSelection: {
      text,
      elementTypes: extracted.focus.elementTypes,
    },
    localContextBlock: localContextBlock || undefined,
    selectedMedia: buildSelectedMedia(extracted),
    cropImageBase64: crop,
    meta: {
      extractionStrategy: extracted.meta.extractionStrategy,
      selectionTier: tier,
      estimatedTextTokens: estimateTokens(text + localContextBlock),
      estimatedImageBytes: crop
        ? Math.round((crop.length * 3) / 4)
        : undefined,
      hasImage: Boolean(crop),
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
