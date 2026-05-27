import type { SelectionCandidate } from "./types.js";
import { normalizeCandidateText } from "./candidateTextCleanup.js";
import { isBrokenFragment } from "../focus/quality.js";

function candidateTextKey(c: SelectionCandidate): string {
  const text = normalizeCandidateText(c.text ?? "").toLowerCase();
  return `${c.type}|${c.uiRole ?? ""}|${text}`;
}

function isSubsumedToken(token: SelectionCandidate, phrase: SelectionCandidate): boolean {
  if (token.type !== "text-token" || !token.text || !phrase.text) return false;
  const t = normalizeCandidateText(token.text).toLowerCase();
  const p = normalizeCandidateText(phrase.text).toLowerCase();
  if (t === p) return true;
  if (p.includes(t) && t.length >= 3) return true;
  return false;
}

const STRUCTURAL_TYPES = new Set([
  "heading",
  "button",
  "link",
  "tab",
  "code-block",
  "region",
  "media",
  "structured",
]);

/**
 * Deduplicate candidates after normalization; drop tokens subsumed by phrase/structural candidates.
 */
export function dedupeCandidates(
  candidates: SelectionCandidate[]
): SelectionCandidate[] {
  const byKey = new Map<string, SelectionCandidate>();

  for (const c of candidates) {
    const key = candidateTextKey(c);
    const existing = byKey.get(key);
    if (!existing || c.visualWeight > existing.visualWeight) {
      byKey.set(key, c);
    }
  }

  let deduped = [...byKey.values()];

  const phrases = deduped.filter(
    (c) =>
      STRUCTURAL_TYPES.has(c.type) ||
      c.signals.includes("phrase-expanded") ||
      c.type === "text-fragment"
  );

  if (phrases.length) {
    deduped = deduped.filter((c) => {
      if (c.type !== "text-token") return true;
      return !phrases.some((p) => isSubsumedToken(c, p));
    });
  }

  // Drop broken / partial-word tokens entirely if any other substantive candidate exists.
  const hasSubstantive =
    deduped.filter(
      (c) =>
        Boolean(c.text?.trim()) &&
        c.type !== "text-token" &&
        !isBrokenFragment(c.text!)
    ).length > 0;

  if (hasSubstantive) {
    deduped = deduped.filter((c) => {
      if (c.type !== "text-token" || !c.text) return true;
      return !isBrokenFragment(c.text);
    });
  }

  return deduped.sort((a, b) => b.visualWeight - a.visualWeight);
}
