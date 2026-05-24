import type { SelectionRect } from "../types.js";
import type { Point2D } from "../types.js";
import type { FocusExtractionMethod } from "../types.js";
import { LIMITS } from "../constants.js";
import { extractTextInRect } from "../dom/text.js";
import { prepareText } from "../text/clean.js";
import type { ExtractionCandidate, FocusExtractionResult } from "./types.js";
import type { FocusExtractionContext } from "./types.js";
import { lassoCenterFrom } from "./geometry.js";
import {
  collectTextTokenCandidates,
  collectInlinePhraseCandidate,
} from "./tokenCandidates.js";
import {
  collectPolygonTextRangeCandidates,
  collectCenterLineTextCandidate,
} from "./polygonTextRange.js";
import { collectCharacterRunCandidates } from "./characterRuns.js";
import { collectMediaCandidates } from "./mediaCandidates.js";
import { collectStructuredCandidates } from "./structuredCandidates.js";
import {
  scoreElementFallback,
  attachConfidence,
} from "./scoreCandidate.js";
import { computeFocusConfidence, resolveMethod } from "./confidence.js";
import { isBrokenFragment } from "./quality.js";

export function buildFocusExtractionContext(
  bbox: SelectionRect,
  polygon: Point2D[] | undefined,
  elements: Element[]
): FocusExtractionContext {
  const hasPolygon = Boolean(polygon && polygon.length >= 3);
  return {
    bbox,
    polygon: hasPolygon ? polygon : undefined,
    lassoCenter: lassoCenterFrom(bbox, polygon),
    selectionArea: bbox.width * bbox.height,
    hasPolygon,
    elements,
  };
}

function rankCandidates(candidates: ExtractionCandidate[]): ExtractionCandidate[] {
  return [...candidates].sort((a, b) => b.score - a.score);
}

function safeCandidates(
  label: string,
  fn: () => ExtractionCandidate[]
): ExtractionCandidate[] {
  try {
    return fn();
  } catch (err) {
    console.warn(`[syncle] ${label} failed:`, err);
    return [];
  }
}

function collectTextCandidates(ctx: FocusExtractionContext): ExtractionCandidate[] {
  const textFirst: ExtractionCandidate[] = [];

  const centerLine = safeCandidates("center-line", () => {
    const c = collectCenterLineTextCandidate(ctx);
    return c ? [c] : [];
  });
  textFirst.push(...centerLine);

  textFirst.push(
    ...safeCandidates("polygon-range", () => collectPolygonTextRangeCandidates(ctx))
  );
  textFirst.push(
    ...safeCandidates("char-runs", () => collectCharacterRunCandidates(ctx))
  );

  const inline = safeCandidates("inline-phrase", () => {
    const c = collectInlinePhraseCandidate(ctx);
    return c ? [c] : [];
  });
  textFirst.push(...inline);

  textFirst.push(
    ...safeCandidates("text-tokens", () => collectTextTokenCandidates(ctx))
  );

  return textFirst;
}

/**
 * Collect mechanical extraction candidates. Does not pick semantic focus —
 * `text` on the result is a debug hint (top mechanical candidate) only.
 */
export function extractFocusFromSelection(
  bbox: SelectionRect,
  elements: Element[],
  polygon?: Point2D[]
): FocusExtractionResult {
  const ctx = buildFocusExtractionContext(bbox, polygon, elements);

  const textCandidates = collectTextCandidates(ctx);
  const nonTextCandidates = [
    ...collectStructuredCandidates(ctx),
    ...collectMediaCandidates(ctx),
  ];

  let ranked = rankCandidates([...textCandidates, ...nonTextCandidates]);

  if (ctx.selectionArea >= 28_000) {
    const loose = extractTextInRect(bbox);
    if (loose && !isBrokenFragment(loose)) {
      const { score, reasonCodes } = scoreElementFallback(loose, ctx);
      if (score > 0) {
        ranked = rankCandidates([
          ...ranked,
          attachConfidence({
            type: "element",
            text: loose,
            rect: {
              left: bbox.left,
              top: bbox.top,
              right: bbox.right,
              bottom: bbox.bottom,
              width: bbox.width,
              height: bbox.height,
            },
            score,
            confidence: 0,
            reasonCodes,
          }),
        ]);
      }
    }
  }

  const top = ranked[0];

  if (!top || top.score < 0) {
    return {
      text: "",
      confidence: 0.12,
      extractionMethod: "visual-fallback",
      uncertain: true,
      candidates: ranked.slice(0, 20),
    };
  }

  const debugText = prepareText(top.text ?? "", LIMITS.focusText);
  const method: FocusExtractionMethod = resolveMethod(top, ctx.hasPolygon, top.type === "element");
  const confidence = computeFocusConfidence(ranked, top, method, ctx.hasPolygon);

  return {
    text: debugText,
    confidence,
    extractionMethod: method,
    uncertain: confidence < 0.55,
    candidates: ranked.slice(0, 24),
  };
}
