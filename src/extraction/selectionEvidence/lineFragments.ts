import type { ExtractionCandidate as InternalCandidate } from "../focus/types.js";
import type { FocusExtractionContext } from "../focus/types.js";
import { isWeakToken } from "../focus/quality.js";
import {
  joinTokensWithBoundaries,
  normalizeCandidateText,
  rejectNoisyMergedCandidate,
} from "./candidateTextCleanup.js";
import { classifySelectionSize } from "./selectionSize.js";

function lineKey(rect: { top: number; height: number }): number {
  return Math.round(rect.top + rect.height / 2);
}

/**
 * Per-line text-fragment candidates (small/medium selections only).
 * Skips cross-line mega-merge for large region selections.
 */
export function buildLineFragmentCandidates(
  ranked: InternalCandidate[],
  ctx: FocusExtractionContext
): InternalCandidate[] {
  const sizeClass = classifySelectionSize(ctx);
  if (sizeClass === "large") return [];

  const textTypes = new Set(["text-token", "text-range", "text-fragment"]);
  const tokens = ranked.filter(
    (c) => textTypes.has(c.type) && c.text && c.score > 0
  );
  if (!tokens.length) return [];

  const byLine = new Map<number, InternalCandidate[]>();
  for (const t of tokens) {
    const key = lineKey(t.rect);
    const list = byLine.get(key) ?? [];
    list.push(t);
    byLine.set(key, list);
  }

  const lines = [...byLine.entries()].sort((a, b) => a[0] - b[0]);
  const out: InternalCandidate[] = [];

  for (const [, lineTokens] of lines) {
    const sorted = [...lineTokens].sort((a, b) => a.rect.left - b.rect.left);
    const strong = sorted.filter((t) => !isWeakToken(t.text!) || t.score >= 40);
    const use = strong.length ? strong : sorted;

    const sameParent = use.every(
      (t) => t.element && t.element === use[0]?.element
    );
    const text = sameParent && use[0]?.element
      ? normalizeCandidateText(use[0].element.textContent ?? "")
      : joinTokensWithBoundaries(use.map((t) => t.text!));

    if (!text || text.length < 2 || rejectNoisyMergedCandidate(text)) continue;

    const left = Math.min(...use.map((t) => t.rect.left));
    const right = Math.max(...use.map((t) => t.rect.right));
    const top = Math.min(...use.map((t) => t.rect.top));
    const bottom = Math.max(...use.map((t) => t.rect.bottom));
    const avgScore =
      use.reduce((s, t) => s + t.score, 0) / Math.max(1, use.length);

    out.push({
      type: "text-fragment",
      text,
      rect: { left, top, right, bottom, width: right - left, height: bottom - top },
      score: avgScore + 6,
      confidence: Math.min(1, avgScore / 95),
      reasonCodes: ["text-range", "line-fragment"],
    });
  }

  if (sizeClass === "small" && lines.length >= 2 && lines.length <= 3) {
    const perLine = out.map((f) => f.text!).filter(Boolean);
    if (perLine.length >= 2 && perLine.join(" ").length < 200) {
      const combined = joinTokensWithBoundaries(perLine);
      if (combined && !rejectNoisyMergedCandidate(combined)) {
        const allTokens = tokens.filter((t) => t.score >= 12);
        const left = Math.min(...allTokens.map((t) => t.rect.left));
        const right = Math.max(...allTokens.map((t) => t.rect.right));
        const top = Math.min(...allTokens.map((t) => t.rect.top));
        const bottom = Math.max(...allTokens.map((t) => t.rect.bottom));
        const avgScore =
          allTokens.reduce((s, t) => s + t.score, 0) / Math.max(1, allTokens.length);
        out.push({
          type: "text-fragment",
          text: combined,
          rect: {
            left,
            top,
            right,
            bottom,
            width: right - left,
            height: bottom - top,
          },
          score: avgScore + 2,
          confidence: Math.min(1, avgScore / 95),
          reasonCodes: ["text-range", "multi-line-fragment", "combined-selection"],
        });
      }
    }
  }

  return out;
}
