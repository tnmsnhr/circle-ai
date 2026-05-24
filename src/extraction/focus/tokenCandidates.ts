import type { FocusExtractionContext } from "./types.js";
import type { ExtractionCandidate } from "./types.js";
import { pageElementFromPoint } from "../dom/pageHitTest.js";
import { collectTextNodesInSelection } from "./textNodes.js";
import { scoreTextTokenCandidate, attachConfidence } from "./scoreCandidate.js";

/** Non-whitespace runs — preserves dotted/symbolic compact tokens. */
const TOKEN_RE = /\S+/g;

function tokenizeText(text: string): Array<{ start: number; end: number; text: string }> {
  const out: Array<{ start: number; end: number; text: string }> = [];
  let m: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(text))) {
    out.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
  }
  return out;
}

export function collectTextTokenCandidates(
  ctx: FocusExtractionContext
): ExtractionCandidate[] {
  const out: ExtractionCandidate[] = [];
  const minScore = ctx.hasPolygon ? 8 : 5;
  const nodes = collectTextNodesInSelection(ctx.bbox, ctx.elements);
  const primaryY = ctx.lassoCenter.y;

  for (const textNode of nodes) {
    const full = textNode.textContent ?? "";
    const parent = textNode.parentElement;
    if (!parent) continue;

    for (const tok of tokenizeText(full)) {
      const range = document.createRange();
      try {
        range.setStart(textNode, tok.start);
        range.setEnd(textNode, tok.end);
      } catch {
        continue;
      }

      const rects = range.getClientRects();
      let bestRect: DOMRect | null = null;
      let bestScore = -Infinity;
      let bestReasons: string[] = [];

      for (let i = 0; i < rects.length; i++) {
        const { score, reasonCodes } = scoreTextTokenCandidate(
          tok.text,
          rects[i],
          parent,
          ctx
        );
        if (score > bestScore) {
          bestScore = score;
          bestRect = rects[i];
          bestReasons = reasonCodes;
        }
      }

      if (!bestRect || bestScore < minScore) continue;

      if (ctx.selectionArea < 35_000) {
        const cy = bestRect.top + bestRect.height / 2;
        if (Math.abs(cy - primaryY) > 22) continue;
      }

      out.push(
        attachConfidence({
          type: "text-token",
          text: tok.text,
          rect: {
            left: bestRect.left,
            top: bestRect.top,
            right: bestRect.right,
            bottom: bestRect.bottom,
            width: bestRect.width,
            height: bestRect.height,
          },
          element: parent,
          score: bestScore,
          confidence: 0,
          reasonCodes: bestReasons,
        })
      );
    }
  }

  return out;
}

/** Inline phrase from element at lasso center (handles split DOM spans). */
export function collectInlinePhraseCandidate(
  ctx: FocusExtractionContext
): ExtractionCandidate | undefined {
  const el = pageElementFromPoint(ctx.lassoCenter.x, ctx.lassoCenter.y);
  if (!el || !(el instanceof HTMLElement)) return undefined;

  let target: Element = el;
  let cur: Element | null = el;
  for (let d = 0; cur && d < 8; d++) {
    const tag = cur.tagName;
    if (tag === "CODE" || tag === "KBD" || tag === "SAMP" || tag === "MARK") {
      target = cur;
      break;
    }
    if (tag === "A" || tag === "SPAN") target = cur;
    cur = cur.parentElement;
  }

  const text = (target.textContent ?? "").trim();
  if (!text || text.length > 120 || /\n/.test(text)) return undefined;

  const box = target.getBoundingClientRect();
  const { score, reasonCodes } = scoreTextTokenCandidate(
    text,
    box,
    target,
    ctx
  );
  if (score < 12) return undefined;

  return attachConfidence({
    type: "text-range",
    text,
    rect: {
      left: box.left,
      top: box.top,
      right: box.right,
      bottom: box.bottom,
      width: box.width,
      height: box.height,
    },
    element: target,
    score: score + 6,
    confidence: 0,
    reasonCodes: [...reasonCodes, "inline-phrase"],
  });
}
