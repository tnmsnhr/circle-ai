import type { ExtractionCandidate } from "./types.js";
import { sameVisualLine } from "./geometry.js";
import { isCompactToken, isWeakToken } from "./quality.js";

function joinTokenTexts(parts: string[]): string {
  if (!parts.length) return "";
  let out = parts[0] ?? "";
  for (let i = 1; i < parts.length; i++) {
    const prev = parts[i - 1] ?? "";
    const cur = parts[i] ?? "";
    if (/[.\-(/\\]$/.test(prev) || /^[.,;:)\]}]/.test(cur)) {
      out += cur;
    } else if (isCompactToken(prev) && isCompactToken(cur)) {
      out += cur;
    } else {
      out += ` ${cur}`;
    }
  }
  return out;
}

/** Group adjacent selected tokens on the same visual line near the winner. */
export function groupAdjacentTextTokens(
  winner: ExtractionCandidate,
  tokens: ExtractionCandidate[],
  maxGap = 28
): string {
  const lineTokens = tokens
    .filter(
      (c) =>
        (c.type === "text-token" || c.type === "text-range") &&
        c.text &&
        sameVisualLine(c.rect, winner.rect) &&
        c.score >= winner.score * 0.35 &&
        !isWeakToken(c.text!)
    )
    .sort((a, b) => a.rect.left - b.rect.left);

  if (!lineTokens.length) return winner.text ?? "";

  const grouped: ExtractionCandidate[] = [];
  for (const t of lineTokens) {
    if (!grouped.length) {
      grouped.push(t);
      continue;
    }
    const prev = grouped[grouped.length - 1]!;
    const gap = t.rect.left - (prev.rect.left + prev.rect.width);
    if (gap <= maxGap) grouped.push(t);
  }

  if (grouped.length === 1) return grouped[0]!.text ?? "";
  return joinTokenTexts(grouped.map((g) => g.text!));
}

/** Prefer text candidates when selection is text-sized. */
export function pickTextWinner(
  ranked: ExtractionCandidate[],
  selectionArea: number
): ExtractionCandidate | undefined {
  if (!ranked.length) return undefined;

  const textTypes = new Set(["text-token", "text-range"]);
  const bestText = ranked.find((c) => textTypes.has(c.type));
  const best = ranked[0]!;

  if (!bestText) return best;
  if (textTypes.has(best.type)) return best;

  if (selectionArea < 45_000 && bestText.score >= best.score * 0.72) {
    return bestText;
  }

  if (best.type === "media" && bestText.score >= best.score * 0.85) {
    return bestText;
  }

  return best;
}
