/** Generic token quality — no domain-specific recognizers. */

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "it",
  "is",
  "in",
  "on",
  "at",
  "to",
  "of",
  "or",
  "and",
  "as",
  "by",
  "for",
  "if",
  "when",
  "then",
  "that",
  "this",
  "with",
  "from",
  "be",
  "was",
  "are",
  "were",
  "has",
  "have",
  "had",
  "not",
  "but",
  "so",
  "do",
  "does",
  "did",
  "can",
  "will",
  "also",
  "exists",
  "exist",
  "your",
  "you",
  "we",
  "they",
  "their",
  "its",
  "our",
]);

export function isStopWord(token: string): boolean {
  const t = token.trim().toLowerCase();
  return t.length <= 6 && STOP_WORDS.has(t);
}

export function isBrokenFragment(text: string): boolean {
  const t = text.trim();
  if (!t || t.length < 4) return false;

  const words = t.split(/\s+/).filter(Boolean);

  // Single token starting lowercase with no word boundary at start (likely mid-word clip)
  if (
    words.length === 1 &&
    /^[a-z]{4,}$/.test(words[0]!) &&
    t.length < 24 &&
    !/[.!?,:;)\]}"'`]$/.test(t)
  ) {
    return true;
  }

  // Starts mid-word when first word is lowercase and selection has multiple words
  if (
    words.length >= 2 &&
    /^[a-z]{3,}/.test(words[0]!) &&
    !/^https?:\/\//i.test(t)
  ) {
    return true;
  }

  // Ends mid-word: last word is short lowercase tail without closing punctuation
  const last = words[words.length - 1] ?? "";
  if (
    /[a-z]{2,4}$/.test(last) &&
    !/[.!?,:;)\]}"'`]$/.test(t) &&
    t.length < 56 &&
    words.length >= 2
  ) {
    return true;
  }

  return false;
}

/** @deprecated Use isBrokenFragment */
export const looksLikeBrokenTextFragment = isBrokenFragment;

export function isCompactToken(token: string): boolean {
  const t = token.trim();
  if (!t || t.length > 80 || /\s/.test(t)) return false;
  if (/[._/$@#+=^()[\]{}|\\-]/.test(t)) return true;
  if (/[A-Z]/.test(t) && /[a-z]/.test(t)) return true;
  if (/\d/.test(t) && /[a-zA-Z]/.test(t)) return true;
  return t.length >= 5;
}

export function isWeakToken(token: string): boolean {
  const t = token.trim();
  if (!t) return true;
  if (isStopWord(t)) return true;
  if (isBrokenFragment(t)) return true;
  if (t.length <= 2 && !/\d/.test(t)) return true;
  return false;
}

export function looksCodeLike(text: string): boolean {
  const t = text.trim();
  if (t.length < 4) return false;
  if (
    /\b(function|const|let|var|class|return|import|export|async|await)\b/.test(t)
  ) {
    return true;
  }
  if (/=>/.test(t) && /[({;]/.test(t)) return true;
  if (t.includes("{") && t.includes("}")) return true;
  if (/<\/?[A-Za-z][\w-]*(\s|>|\/)/.test(t)) return true;
  return false;
}
