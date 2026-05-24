import type { ExtractedContext } from "../types.js";
import type { SelectionEvidence } from "./types.js";
import type { SelectionShape } from "../selectionShape.js";
import { hasWeakOnlyEvidence } from "./buildSelectionEvidence.js";
import { isBrokenFragment } from "../focus/quality.js";

export function shouldIncludeCrop(
  evidence: SelectionEvidence,
  extracted: ExtractedContext,
  selectionShape: SelectionShape
): boolean {
  if (selectionShape === "visual_selection") return true;
  if (selectionShape === "mixed_selection") return true;

  const hasMediaCandidate = evidence.candidates.some((c) => c.type === "media");
  const partialMedia = evidence.candidates.some((c) =>
    c.metadata?.isPartialMedia
  );
  const types = extracted.focus.elementTypes;

  if (
    hasMediaCandidate ||
    partialMedia ||
    types.some((t) => ["image", "canvas", "video", "svg", "pdf"].includes(t))
  ) {
    return true;
  }

  if (hasWeakOnlyEvidence(evidence)) return true;

  if (evidence.evidenceConfidence < 0.65) return true;

  const top = evidence.candidates[0];
  if (top?.text && isBrokenFragment(top.text)) return true;

  if (
    evidence.evidenceConfidence < 0.8 &&
    top?.signals.includes("bbox-only-fallback")
  ) {
    return true;
  }

  if (selectionShape === "short_inline_selection" && evidence.evidenceConfidence < 0.75) {
    return true;
  }

  if (
    selectionShape === "long_text_selection" ||
    selectionShape === "multi_line_text_selection"
  ) {
    return false;
  }

  if (
    selectionShape === "code_like_selection" &&
    evidence.evidenceConfidence >= 0.7 &&
    !hasWeakOnlyEvidence(evidence)
  ) {
    return false;
  }

  return evidence.evidenceConfidence < 0.55;
}
