/**
 * Normalize whitespace, drop noise, dedupe lines, and enforce char limits.
 */

export function cleanText(raw: string): string {
  return raw
    .replace(/\u00a0/g, " ")
    .replace(/[\t\f\v]+/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function dedupeLines(text: string): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 2) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out.join("\n");
}

export function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars - 1)}…`;
}

export function prepareText(
  raw: string,
  maxChars: number
): string {
  return truncate(dedupeLines(cleanText(raw)), maxChars);
}

/** Rough token estimate for logging/debug (chars / 4). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
