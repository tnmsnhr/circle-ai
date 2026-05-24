import type { SelectionRect } from "../types.js";
import { cleanText } from "../text/clean.js";
import { caretAt, rangeFromCarets } from "../focus/caret.js";

/**
 * Extract text using caret positions at selection bbox edges (bbox-only fallback).
 */
export function extractStrictSelectedText(rect: SelectionRect): string {
  const pad = 2;
  const y = rect.top + rect.height / 2;
  const xStart = rect.left + pad;
  const xEnd = Math.max(xStart + 1, rect.right - pad);

  const start = caretAt(xStart, y);
  const end = caretAt(xEnd, y);
  if (!start || !end) return "";

  const range = rangeFromCarets(start, end);
  if (!range) return "";

  const text = range.toString().trim();
  return text ? cleanText(text) : "";
}
