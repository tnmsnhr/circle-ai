import type { FocusExtractionMethod } from "../types.js";
import type { ExtractionCandidate } from "./types.js";
import { isBrokenFragment, isWeakToken } from "./quality.js";

export function computeFocusConfidence(
  ranked: ExtractionCandidate[],
  winner: ExtractionCandidate,
  method: FocusExtractionMethod,
  hasPolygon: boolean
): number {
  if (!winner.text?.trim() && winner.type !== "media") {
    return method === "visual-fallback" ? 0.12 : 0.18;
  }

  let c = Math.min(1, Math.max(0.08, winner.score / 92));

  const second = ranked.find((x) => x !== winner);
  if (second && winner.score - second.score < 12) {
    c *= 0.72;
  }

  if (winner.text) {
    if (isWeakToken(winner.text)) c *= 0.28;
    else if (isBrokenFragment(winner.text)) c *= 0.32;
  }

  if (method === "token-polygon") c = Math.min(1, c + 0.08);
  if (method === "token-bbox") c *= 0.82;
  if (method === "element-fallback") c *= 0.62;
  if (method === "media-crop") c = Math.max(c, 0.55);
  if (!hasPolygon && method.startsWith("token")) c *= 0.88;

  if (winner.type === "text-range") c = Math.min(1, c + 0.06);

  if (winner.type === "media") {
    c = Math.max(c, winner.metadata?.isPartialSelection ? 0.6 : 0.45);
  }

  return Math.max(0.05, Math.min(1, c));
}

export function isUncertain(confidence: number): boolean {
  return confidence < 0.45;
}

export function resolveMethod(
  winner: ExtractionCandidate,
  hasPolygon: boolean,
  usedElementFallback: boolean
): FocusExtractionMethod {
  if (winner.type === "media") return "media-crop";
  if (usedElementFallback) return "element-fallback";
  if (winner.type === "text-token" || winner.type === "text-range") {
    return hasPolygon ? "token-polygon" : "token-bbox";
  }
  if (winner.type === "structured") {
    return hasPolygon ? "token-polygon" : "token-bbox";
  }
  return "visual-fallback";
}
