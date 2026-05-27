import type { ExtractedContext } from "../types.js";
import type { SelectionShape } from "../selectionShape.js";
import type { SelectionTier } from "../constants.js";
import type { SelectionCandidate, SelectionEvidence } from "./types.js";
import { uiRoleLabel } from "./uiRole.js";
import { normalizeCandidateText } from "./candidateTextCleanup.js";
import { expandRect } from "../geometry/rect.js";
import { extractTextInRect } from "../dom/text.js";
import { prepareText } from "../text/clean.js";
import { LIMITS } from "../constants.js";
import { findSelectionContainer } from "./regionContainer.js";
import { findCodeContainer } from "./codeBlockExtract.js";
import { buildCodeBlockLocalContext } from "./codeLocalContext.js";
import { buildSectionHeadingContext } from "./sectionHeadingContext.js";
import type { FocusExtractionContext } from "../focus/types.js";

function findCodeContainerForContext(
  extracted: ExtractedContext,
  elements: Element[]
): HTMLElement | null {
  const rect = extracted.meta.selectionRect;
  const ctx: FocusExtractionContext = {
    bbox: rect,
    polygon: extracted.meta.selectionPolygon,
    lassoCenter: {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    },
    selectionArea: rect.width * rect.height,
    hasPolygon: Boolean(
      extracted.meta.selectionPolygon &&
        extracted.meta.selectionPolygon.length >= 3
    ),
    elements,
  };
  return findCodeContainer(ctx, elements)?.element ?? null;
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

function contextBudget(
  tier: SelectionTier,
  shape: SelectionShape,
  extracted: ExtractedContext,
  evidence?: SelectionEvidence
): number {
  const effectiveTier = isTinyVisual(extracted, tier) ? "medium" : tier;

  if (shape === "structured_region_selection") return 1400;
  if (shape === "section_heading_selection") return 1100;
  if (shape === "code_like_selection" && evidence?.isLargeCodeBlock) return 900;
  if (shape === "short_inline_selection") {
    return effectiveTier === "tiny" ? 900 : 700;
  }
  if (shape === "multi_line_text_selection") {
    return effectiveTier === "large" ? 1800 : 1200;
  }
  if (shape === "long_text_selection") {
    return effectiveTier === "large" ? 3500 : 2200;
  }
  if (shape === "visual_selection" || shape === "mixed_selection") {
    return effectiveTier === "tiny" ? 1800 : 2200;
  }
  if (effectiveTier === "tiny") return 900;
  if (effectiveTier === "large") return 2500;
  return 1800;
}

function buildFromGroupedCandidates(evidence: SelectionEvidence): string {
  const parts: string[] = [];
  const region = evidence.candidates.find((c) => c.type === "region");
  if (region?.text) {
    parts.push(`[Region] ${region.text}`);
  }

  const byRole = new Map<string, string[]>();
  for (const c of evidence.candidates) {
    if (c.type === "region" || !c.text?.trim()) continue;
    const role = c.uiRole ?? "unknown";
    const label = uiRoleLabel(role);
    const list = byRole.get(label) ?? [];
    list.push(c.text.trim());
    byRole.set(label, list);
  }

  for (const [label, texts] of byRole) {
    const unique = [...new Set(texts.map((t) => normalizeCandidateText(t)))];
    if (unique.length) parts.push(`[${label}] ${unique.join("; ")}`);
  }

  return parts.join("\n");
}

function textInsideContainerOnly(
  extracted: ExtractedContext,
  elements: Element[],
  paddingPx: number
): string {
  const rect = extracted.meta.selectionRect;
  const container = findSelectionContainer(rect, elements);
  if (!container) return "";

  const box = container.getBoundingClientRect();
  const clip = {
    left: Math.max(rect.left, box.left) - paddingPx,
    top: Math.max(rect.top, box.top) - paddingPx,
    right: Math.min(rect.right, box.right) + paddingPx,
    bottom: Math.min(rect.bottom, box.bottom) + paddingPx,
    width: 0,
    height: 0,
  };
  clip.width = clip.right - clip.left;
  clip.height = clip.bottom - clip.top;

  return prepareText(extractTextInRect(clip), LIMITS.nearbyText);
}

/**
 * Disambiguation context — bounded for region selections.
 */
export function buildLocalContextBlock(
  extracted: ExtractedContext,
  tier: SelectionTier,
  selectionShape: SelectionShape,
  evidence?: SelectionEvidence,
  elements: Element[] = []
): string {
  const max = contextBudget(tier, selectionShape, extracted, evidence);

  if (
    selectionShape === "code_like_selection" &&
    evidence?.isLargeCodeBlock
  ) {
    const container = findCodeContainerForContext(extracted, elements);
    const block = buildCodeBlockLocalContext(extracted, container, max);
    return block;
  }

  if (
    selectionShape === "section_heading_selection" &&
    evidence?.candidates?.length
  ) {
    const headingCand = evidence.candidates.find(
      (c) => c.type === "heading" || c.uiRole === "heading"
    );
    if (headingCand?.text) {
      return buildSectionHeadingContext(
        extracted,
        headingCand.text,
        null,
        max
      );
    }
  }

  if (
    selectionShape === "structured_region_selection" &&
    evidence?.candidates?.length
  ) {
    const block = buildFromGroupedCandidates(evidence);
    return block.length <= max ? block : `${block.slice(0, max)}…`;
  }

  const parts: string[] = [];
  const rect = extracted.meta.selectionRect;
  const tight =
    selectionShape === "structured_region_selection"
      ? expandRect(rect, 24, {
          width: window.innerWidth,
          height: window.innerHeight,
        })
      : null;

  const heading =
    extracted.context.h1?.trim() ||
    extracted.context.headings.find((h) => h.trim());
  if (heading) parts.push(`[Heading] ${heading}`);

  if (extracted.context.tableHeaders.length) {
    parts.push(
      `[Table headers] ${extracted.context.tableHeaders.filter(Boolean).join(" · ")}`
    );
  }

  if (selectionShape === "structured_region_selection") {
    const scoped = textInsideContainerOnly(extracted, elements, 16);
    if (scoped) parts.push(scoped);
  } else {
    if (extracted.context.captions.length) {
      parts.push(extracted.context.captions.filter(Boolean).join("\n"));
    }
    if (extracted.context.nearbyText?.trim()) {
      const nearby = extracted.context.nearbyText.trim();
      if (!tight || nearby.length < max * 0.8) {
        parts.push(nearby);
      }
    } else if (extracted.context.ancestorText?.trim()) {
      parts.push(
        extracted.context.ancestorText.trim().slice(0, Math.min(max, 1200))
      );
    }
  }

  const block = parts.join("\n\n").trim();
  return block.length <= max ? block : `${block.slice(0, max)}…`;
}
