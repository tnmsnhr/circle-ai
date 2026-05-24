import type { ExtractionCandidate as InternalCandidate } from "../focus/types.js";
import type { FocusExtractionContext } from "../focus/types.js";
import { isWeakToken } from "../focus/quality.js";

function joinTokenTexts(parts: string[]): string {
  if (!parts.length) return "";
  let out = parts[0] ?? "";
  for (let i = 1; i < parts.length; i++) {
    const prev = parts[i - 1] ?? "";
    const cur = parts[i] ?? "";
    if (/[.\-(/\\]$/.test(prev) || /^[.,;:)\]}]/.test(cur)) {
      out += cur;
    } else if (isWeakToken(prev) && isWeakToken(cur)) {
      out += ` ${cur}`;
    } else if (/^\w/.test(cur) && /\w$/.test(prev) && !/\s/.test(prev.slice(-1))) {
      out += cur;
    } else {
      out += ` ${cur}`;
    }
  }
  return out.trim();
}

function lineKey(rect: { top: number; height: number }): number {
  return Math.round(rect.top + rect.height / 2);
}

/**
 * Per-line text-fragment candidates + optional combined multi-line fragment.
 */
export function buildLineFragmentCandidates(
  ranked: InternalCandidate[],
  ctx: FocusExtractionContext
): InternalCandidate[] {
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
    const text = joinTokenTexts(use.map((t) => t.text!));
    if (!text || text.length < 2) continue;

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
      score: avgScore + 8,
      confidence: Math.min(1, avgScore / 95),
      reasonCodes: ["text-range", "line-fragment", "same-line-as-center"],
    });
  }

  if (lines.length >= 2) {
    const allTokens = tokens
      .filter((t) => t.score >= 12)
      .sort((a, b) => {
        const dy = lineKey(a.rect) - lineKey(b.rect);
        if (dy !== 0) return dy;
        return a.rect.left - b.rect.left;
      });
    const perLineTexts = out.map((f) => f.text!);
    const combined = joinTokenTexts(
      allTokens
        .filter((t) => !isWeakToken(t.text!) || allTokens.length <= 3)
        .map((t) => t.text!)
    );
    if (combined && combined.length > (perLineTexts[0]?.length ?? 0)) {
      const left = Math.min(...allTokens.map((t) => t.rect.left));
      const right = Math.max(...allTokens.map((t) => t.rect.right));
      const top = Math.min(...allTokens.map((t) => t.rect.top));
      const bottom = Math.max(...allTokens.map((t) => t.rect.bottom));
      const avgScore =
        allTokens.reduce((s, t) => s + t.score, 0) / Math.max(1, allTokens.length);
      out.push({
        type: "text-fragment",
        text: combined,
        rect: { left, top, right, bottom, width: right - left, height: bottom - top },
        score: avgScore + 4,
        confidence: Math.min(1, avgScore / 95),
        reasonCodes: ["text-range", "multi-line-fragment", "combined-selection"],
      });
    }
  }

  return out;
}
