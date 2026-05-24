import type { ExtractedContext } from "../types.js";
import type { SelectionShape } from "../selectionShape.js";
import type { SelectionTier } from "../constants.js";

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
  extracted: ExtractedContext
): number {
  const effectiveTier = isTinyVisual(extracted, tier) ? "medium" : tier;

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

/**
 * Disambiguation context only — not nav/footer or full page body.
 */
export function buildLocalContextBlock(
  extracted: ExtractedContext,
  tier: SelectionTier,
  selectionShape: SelectionShape
): string {
  const max = contextBudget(tier, selectionShape, extracted);
  const parts: string[] = [];

  const heading =
    extracted.context.h1?.trim() ||
    extracted.context.headings.find((h) => h.trim());
  if (heading) parts.push(`[Heading] ${heading}`);

  if (extracted.context.tableHeaders.length) {
    parts.push(
      `[Table headers] ${extracted.context.tableHeaders.filter(Boolean).join(" · ")}`
    );
  }

  if (extracted.context.captions.length) {
    parts.push(extracted.context.captions.filter(Boolean).join("\n"));
  }

  if (extracted.context.nearbyText?.trim()) {
    parts.push(extracted.context.nearbyText.trim());
  } else if (extracted.context.ancestorText?.trim()) {
    parts.push(extracted.context.ancestorText.trim().slice(0, Math.min(max, 1200)));
  }

  const block = parts.join("\n\n").trim();
  return block.length <= max ? block : `${block.slice(0, max)}…`;
}
