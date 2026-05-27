import type { FocusExtractionContext } from "./types.js";
import type { ExtractionCandidate } from "./types.js";
import {
  distanceToSelectionCenter,
  hitsPolygon,
  overlapRatioWithRect,
} from "./geometry.js";
import { polygonCoverageRatio } from "./textGeometry.js";
import {
  isCompactToken,
  isWeakToken,
  isBrokenFragment,
} from "./quality.js";

const INLINE_TAGS = new Set([
  "CODE",
  "PRE",
  "KBD",
  "SAMP",
  "MARK",
  "A",
  "BUTTON",
  "LABEL",
  "TH",
  "TD",
  "STRONG",
  "B",
  "EM",
  "I",
  "SPAN",
]);

function isInlineStyled(el: Element | null): boolean {
  if (!el) return false;
  let cur: Element | null = el;
  for (let d = 0; cur && d < 7; d++) {
    if (INLINE_TAGS.has(cur.tagName)) return true;
    if (cur instanceof HTMLElement) {
      const style = window.getComputedStyle(cur);
      if (style.fontFamily.includes("mono")) return true;
      if (style.fontWeight === "bold" || Number(style.fontWeight) >= 600) return true;
      const bg = style.backgroundColor;
      if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") return true;
      if (parseFloat(style.borderRadius) > 2 && parseFloat(style.paddingLeft) > 0) {
        return true;
      }
    }
    cur = cur.parentElement;
  }
  return false;
}

export function scoreTextTokenCandidate(
  text: string,
  rect: DOMRect,
  element: Element,
  ctx: FocusExtractionContext
): { score: number; reasonCodes: string[] } {
  const reasons: string[] = [];
  let score = 0;
  const r = {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  };

  const largeSelection = ctx.selectionArea >= 55_000;

  const hit = hitsPolygon(r, ctx.polygon, ctx.bbox);
  if (hit.centerInside) {
    score += largeSelection ? 28 : 60;
    reasons.push("center-in-polygon");
  } else if (hit.intersects) {
    score += 32;
    reasons.push("intersects-polygon");
  } else if (hit.bboxOnly) {
    score += 12;
    reasons.push("bbox-only");
    if (ctx.hasPolygon) score -= 18;
  } else {
    return { score: -999, reasonCodes: ["no-hit"] };
  }

  const overlap = overlapRatioWithRect(r, ctx.bbox);
  score += Math.min(22, overlap * 20);
  if (overlap > 0.5) reasons.push("high-overlap");

  const polyCover = polygonCoverageRatio(r, ctx.polygon, ctx.bbox);
  score += Math.min(28, polyCover * 30);
  if (polyCover > 0.55) reasons.push("high-polygon-cover");

  const dist = distanceToSelectionCenter(r, ctx.lassoCenter);
  score -= dist * 0.07;
  if (dist < 40) reasons.push("near-lasso-center");

  const lineCenterY = ctx.lassoCenter.y;
  const tokenCenterY = r.top + r.height / 2;
  if (Math.abs(tokenCenterY - lineCenterY) <= 12) {
    score += largeSelection ? 4 : 14;
    reasons.push("same-line-as-center");
  }

  if (isInlineStyled(element)) {
    score += 16;
    reasons.push("inline-styled");
  }
  if (isCompactToken(text)) {
    score += 14;
    reasons.push("compact-token");
  }
  if (ctx.selectionArea < 28_000 && isCompactToken(text)) {
    score += 10;
    reasons.push("small-selection-compact");
  }

  if (isWeakToken(text)) {
    score -= 90;
    reasons.push("weak-token");
  } else if (isBrokenFragment(text)) {
    score -= 70;
    reasons.push("broken-fragment");
  }

  if (text.length > 80) {
    score -= 40;
    reasons.push("long-chunk");
  } else if (text.length > 40 && ctx.selectionArea < 28_000) {
    score -= 25;
    reasons.push("long-for-small-selection");
  }

  return { score, reasonCodes: reasons };
}

export function scoreTextRangeCandidate(
  text: string,
  rect: DOMRect,
  ctx: FocusExtractionContext,
  source: "polygon-span" | "center-line" | "char-run"
): { score: number; reasonCodes: string[] } {
  const reasons: string[] = ["text-range", source];
  let score = source === "char-run" ? 38 : 48;

  const r = {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  };

  const largeSelection = ctx.selectionArea >= 55_000;

  const hit = hitsPolygon(r, ctx.polygon, ctx.bbox);
  if (hit.centerInside) {
    score += largeSelection ? 22 : 45;
    reasons.push("center-in-polygon");
  } else if (hit.intersects) {
    score += largeSelection ? 18 : 28;
    reasons.push("intersects-polygon");
  } else if (hit.bboxOnly) {
    score += 10;
    if (ctx.hasPolygon) score -= 22;
  } else {
    return { score: -999, reasonCodes: ["no-hit"] };
  }

  const polyCover = polygonCoverageRatio(r, ctx.polygon, ctx.bbox);
  score += Math.min(35, polyCover * 40);
  if (polyCover > 0.45) reasons.push("high-polygon-cover");

  const dist = distanceToSelectionCenter(r, ctx.lassoCenter);
  score -= dist * (largeSelection ? 0.12 : 0.08);
  if (dist < 36 && !largeSelection) reasons.push("near-lasso-center");

  const lineCenterY = ctx.lassoCenter.y;
  const midY = r.top + r.height / 2;
  if (Math.abs(midY - lineCenterY) <= 10) {
    score += largeSelection ? 4 : 18;
    reasons.push("same-line-as-center");
  }

  if (source === "center-line" && largeSelection) {
    score -= 25;
    reasons.push("center-line");
  }

  if (isCompactToken(text)) {
    score += 12;
    reasons.push("compact-token");
  }
  if (ctx.selectionArea < 28_000 && text.length <= 48) {
    score += 14;
    reasons.push("small-selection-fit");
  }

  if (isWeakToken(text)) {
    score -= 100;
    reasons.push("weak-token");
  } else if (isBrokenFragment(text)) {
    score -= 75;
    reasons.push("broken-fragment");
  }

  const tokenCount = text.split(/\s+/).filter(Boolean).length;
  if (tokenCount > 6 && ctx.selectionArea < 35_000) {
    score -= 35;
    reasons.push("too-many-words-for-lasso");
  }

  if (text.length > 120 && ctx.selectionArea < 45_000) {
    score -= 30;
    reasons.push("long-for-small-selection");
  }

  return { score, reasonCodes: reasons };
}

export function scoreMediaCandidate(
  rect: DOMRect,
  element: Element,
  ctx: FocusExtractionContext,
  partial: boolean
): { score: number; reasonCodes: string[] } {
  const reasons: string[] = ["media"];
  let score = 0;
  const r = {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  };
  const hit = hitsPolygon(r, ctx.polygon, ctx.bbox);
  if (hit.centerInside) {
    score += 50;
    reasons.push("center-in-polygon");
  } else if (hit.intersects) {
    score += 35;
  } else if (hit.bboxOnly) {
    score += 15;
  } else {
    return { score: -999, reasonCodes: ["no-hit"] };
  }
  if (partial) {
    score += 25;
    reasons.push("partial-media");
  }
  score -= distanceToSelectionCenter(r, ctx.lassoCenter) * 0.05;
  if (element.tagName === "CANVAS" || element.tagName === "SVG") score += 8;
  return { score, reasonCodes: reasons };
}

export function scoreStructuredCandidate(
  text: string,
  rect: DOMRect,
  ctx: FocusExtractionContext
): { score: number; reasonCodes: string[] } {
  const reasons: string[] = ["structured"];
  let score = 0;
  const r = {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  };
  const hit = hitsPolygon(r, ctx.polygon, ctx.bbox);
  if (hit.centerInside) score += 55;
  else if (hit.intersects) score += 30;
  else if (hit.bboxOnly) score += 14;
  else return { score: -999, reasonCodes: ["no-hit"] };

  if (text.trim()) {
    score += 10;
    if (!isWeakToken(text)) score += 8;
    else score -= 40;
  }
  score -= distanceToSelectionCenter(r, ctx.lassoCenter) * 0.06;
  return { score, reasonCodes: reasons };
}

export function scoreElementFallback(
  text: string,
  ctx: FocusExtractionContext
): { score: number; reasonCodes: string[] } {
  if (ctx.selectionArea < 28_000) {
    return { score: -999, reasonCodes: ["small-selection-no-element-fallback"] };
  }
  let score = 20;
  const reasons = ["element-fallback"];
  if (isBrokenFragment(text) || isWeakToken(text.split(/\s+/)[0] ?? "")) {
    score -= 50;
    reasons.push("weak-element-text");
  }
  if (!ctx.hasPolygon) score -= 10;
  return { score, reasonCodes: reasons };
}

export function attachConfidence(c: ExtractionCandidate): ExtractionCandidate {
  const conf = Math.max(0.05, Math.min(1, c.score / 95));
  return { ...c, confidence: conf };
}

export function preferNonWeakWinner(
  ranked: ExtractionCandidate[]
): ExtractionCandidate | undefined {
  if (!ranked.length) return undefined;
  const best = ranked[0];
  if (!best.text || !isWeakToken(best.text)) return best;
  const alt = ranked.find(
    (c, i) => i > 0 && c.text && !isWeakToken(c.text) && c.score >= best.score * 0.55
  );
  return alt ?? best;
}
