import type { FocusExtractionContext } from "../focus/types.js";
import type { ExtractionCandidate } from "../focus/types.js";
import { attachConfidence } from "../focus/scoreCandidate.js";
import {
  normalizeCandidateText,
  rejectNoisyMergedCandidate,
} from "./candidateTextCleanup.js";
import { findPhraseParent } from "./domStructuralCandidates.js";
import type { CandidateUiRole } from "./types.js";

const MAX_PHRASE_LEN = 120;
const EXPAND_ROLES = new Set<CandidateUiRole>([
  "heading",
  "button",
  "link",
  "tab",
]);

function mapRoleToType(role: CandidateUiRole): ExtractionCandidate["type"] {
  switch (role) {
    case "heading":
      return "heading";
    case "button":
      return "button";
    case "link":
      return "link";
    case "tab":
      return "tab";
    default:
      return "text-range";
  }
}

function rectFromElement(el: Element): ExtractionCandidate["rect"] {
  const b = el.getBoundingClientRect();
  return {
    left: b.left,
    top: b.top,
    right: b.right,
    bottom: b.bottom,
    width: b.width,
    height: b.height,
  };
}

/**
 * Promote high-scoring tokens to full parent phrases (heading, button, link, tab, inline code).
 */
export function expandPhrasesFromCandidates(
  ranked: ExtractionCandidate[],
  ctx: FocusExtractionContext
): ExtractionCandidate[] {
  const out: ExtractionCandidate[] = [];
  const seen = new Set<string>();

  const tokenSources = ranked.filter(
    (c) =>
      (c.type === "text-token" || c.type === "text-range") &&
      c.text &&
      c.score >= 12 &&
      c.element
  );

  tokenSources.sort((a, b) => b.score - a.score);

  for (const token of tokenSources.slice(0, 12)) {
    const parent = findPhraseParent(token.element ?? null);
    if (!parent) continue;

    const phrase = parent.text.trim();
    if (!phrase || phrase.length > MAX_PHRASE_LEN) continue;
    if (rejectNoisyMergedCandidate(phrase)) continue;

    const tokenNorm = normalizeCandidateText(token.text ?? "").toLowerCase();
    const phraseNorm = phrase.toLowerCase();
    if (phraseNorm === tokenNorm) continue;
    if (!phraseNorm.includes(tokenNorm)) continue;

    const key = `${parent.uiRole}:${phraseNorm}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const type = mapRoleToType(parent.uiRole);
    const isStructural = EXPAND_ROLES.has(parent.uiRole);
    const boost = isStructural ? token.score + 28 : token.score + 14;

    const reasonCodes = [
      "phrase-expanded",
      ...(isStructural && parent.uiRole === "heading" ? ["section-title"] : []),
      ...(parent.uiRole === "heading" ? ["contains-heading"] : []),
      ...(parent.uiRole === "button" || parent.uiRole === "link"
        ? ["contains-actions"]
        : []),
      ...(parent.uiRole === "tab" ? ["contains-tabs"] : []),
      "inside-selection",
    ];

    out.push(
      attachConfidence({
        type,
        text: phrase,
        rect: rectFromElement(parent.element),
        element: parent.element,
        metadata: { uiRole: parent.uiRole },
        score: boost,
        confidence: 0,
        reasonCodes,
      })
    );
  }

  return out.sort((a, b) => b.score - a.score);
}
