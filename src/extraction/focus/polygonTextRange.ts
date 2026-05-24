import type { FocusExtractionContext } from "./types.js";
import type { ExtractionCandidate } from "./types.js";
import { caretAt, rangeFromCarets, rangeText, rangeUnionRect } from "./caret.js";
import {
  estimateLineHeight,
  polygonHorizontalSpan,
} from "./textGeometry.js";
import { scoreTextRangeCandidate, attachConfidence } from "./scoreCandidate.js";
import { isWeakToken } from "./quality.js";

function toRectLike(rect: DOMRect) {
  return {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  };
}

/**
 * Extract text by mapping polygon horizontal span to caret positions on the primary line.
 */
export function collectPolygonTextRangeCandidates(
  ctx: FocusExtractionContext
): ExtractionCandidate[] {
  const out: ExtractionCandidate[] = [];
  const { lassoCenter, bbox, polygon } = ctx;
  const y = lassoCenter.y;

  const centerCaret = caretAt(lassoCenter.x, y);
  const lineHeight = estimateLineHeight(
    centerCaret
      ? (() => {
          const r = document.createRange();
          try {
            r.setStart(centerCaret.node, centerCaret.offset);
            r.setEnd(centerCaret.node, Math.min(centerCaret.offset + 1, (centerCaret.node.textContent ?? "").length));
            return r.getBoundingClientRect();
          } catch {
            return null;
          }
        })()
      : null
  );

  const tolerance = Math.max(8, lineHeight * 0.55);
  const span = polygon?.length
    ? polygonHorizontalSpan(polygon, y, tolerance)
    : { minX: bbox.left + 2, maxX: bbox.right - 2 };

  const pad = 3;
  const xStart = Math.max(bbox.left, span.minX + pad);
  const xEnd = Math.min(bbox.right, span.maxX - pad);
  if (xEnd - xStart < 4) return out;

  const attempts: Array<{ x0: number; x1: number; yy: number }> = [
    { x0: xStart, x1: xEnd, yy: y },
    { x0: xStart, x1: xEnd, yy: y - lineHeight * 0.25 },
    { x0: xStart, x1: xEnd, yy: y + lineHeight * 0.25 },
  ];

  for (const { x0, x1, yy } of attempts) {
    const start = caretAt(x0, yy);
    const end = caretAt(x1, yy);
    if (!start || !end) continue;

    const range = rangeFromCarets(start, end);
    if (!range) continue;

    const text = rangeText(range);
    if (!text || text.length < 1) continue;
    if (isWeakToken(text) && ctx.selectionArea < 12_000) continue;

    const union = rangeUnionRect(range);
    if (!union) continue;

    const { score, reasonCodes } = scoreTextRangeCandidate(
      text,
      union,
      ctx,
      "polygon-span"
    );
    if (score < 8) continue;

    out.push(
      attachConfidence({
        type: "text-range",
        text,
        rect: toRectLike(union),
        score,
        confidence: 0,
        reasonCodes,
      })
    );
  }

  return out;
}

/** Caret-anchored single-line slice at lasso center (tight circles). */
export function collectCenterLineTextCandidate(
  ctx: FocusExtractionContext
): ExtractionCandidate | undefined {
  const y = ctx.lassoCenter.y;
  const cx = ctx.lassoCenter.x;

  const half =
    ctx.polygon?.length && ctx.polygon.length >= 3
      ? Math.max(
          12,
          Math.min(
            120,
            (Math.max(...ctx.polygon.map((p) => p.x)) -
              Math.min(...ctx.polygon.map((p) => p.x))) *
              0.42
          )
        )
      : Math.max(12, Math.min(80, ctx.bbox.width * 0.35));

  const start = caretAt(cx - half, y);
  const end = caretAt(cx + half, y);
  if (!start || !end) return undefined;

  const range = rangeFromCarets(start, end);
  if (!range) return undefined;

  const text = rangeText(range);
  if (!text || isBrokenFragment(text)) return undefined;

  const union = rangeUnionRect(range);
  if (!union) return undefined;

  const { score, reasonCodes } = scoreTextRangeCandidate(
    text,
    union,
    ctx,
    "center-line"
  );
  if (score < 10) return undefined;

  return attachConfidence({
    type: "text-range",
    text,
    rect: {
      left: union.left,
      top: union.top,
      right: union.right,
      bottom: union.bottom,
      width: union.width,
      height: union.height,
    },
    score: score + (ctx.selectionArea < 28_000 ? 8 : 0),
    confidence: 0,
    reasonCodes,
  });
}
