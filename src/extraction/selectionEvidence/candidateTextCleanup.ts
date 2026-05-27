/** Generic candidate text cleanup — no domain-specific rules. */

/** Collapse repeated adjacent tokens: "enabled.enabled" -> "enabled". */
export function collapseAdjacentDuplicateTokens(tokens: string[]): string[] {
  if (!tokens.length) return [];
  const out: string[] = [tokens[0]!];
  for (let i = 1; i < tokens.length; i++) {
    const prev = out[out.length - 1]!.toLowerCase();
    const cur = tokens[i]!.toLowerCase();
    if (cur === prev) continue;
    out.push(tokens[i]!);
  }
  return out;
}

/** Split glued words: "EditProfile" -> "Edit Profile", "UpgradePro" -> "Upgrade Pro". */
function insertWordBoundaries(text: string): string {
  return text
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/([a-zA-Z])(\d)/g, "$1 $2")
    .replace(/(\d)([a-zA-Z])/g, "$1 $2");
}

/** Normalize whitespace and fix common duplication glitches. */
export function normalizeCandidateText(text: string): string {
  let t = text.trim().replace(/\s+/g, " ");
  if (!t) return "";

  t = insertWordBoundaries(t);

  const words = t.split(/\s+/).filter(Boolean);
  const deduped = collapseAdjacentDuplicateTokens(words);
  t = deduped.join(" ");

  t = t.replace(/([.!?])\1+/g, "$1");
  t = t.replace(/\.{2,}/g, ".");

  return t.trim();
}

/** Ratio of tokens that are immediate duplicates (noise indicator). */
export function duplicateTokenRatio(text: string): number {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 2) return 0;
  let dupes = 0;
  for (let i = 1; i < words.length; i++) {
    if (words[i]!.toLowerCase() === words[i - 1]!.toLowerCase()) dupes++;
  }
  return dupes / (words.length - 1);
}

/** True when text looks like glued controls without spaces. */
export function hasGluedWordRuns(text: string): boolean {
  if (text.length < 24) return false;
  const glued = text.match(/[a-z][A-Z][a-z]|[A-Z][a-z][A-Z]/g);
  return (glued?.length ?? 0) >= 3;
}

export function rejectNoisyMergedCandidate(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (duplicateTokenRatio(t) > 0.35) return true;
  if (hasGluedWordRuns(t)) return true;

  const words = t.split(/\s+/).filter(Boolean);
  if (words.length >= 8 && t.length > 80 && !/\s{1}/.test(t.slice(20, 40))) {
    const unique = new Set(words.map((w) => w.toLowerCase()));
    if (unique.size < words.length * 0.55) return true;
  }

  if (t.length > 120 && words.length >= 10) return true;

  return false;
}

export function joinTokensWithBoundaries(tokens: string[]): string {
  const cleaned = collapseAdjacentDuplicateTokens(
    tokens.map((t) => normalizeCandidateText(t)).filter(Boolean)
  );
  return normalizeCandidateText(cleaned.join(" "));
}
