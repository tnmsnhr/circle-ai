import type { SelectionRect } from "../types.js";
import { LIMITS } from "../constants.js";
import { extractStrictSelectedText } from "../dom/selectedText.js";
import { extractTextInRect, extractBlockTextFromElements } from "../dom/text.js";
import { prepareText } from "../text/clean.js";

const SMALL_SELECTION_AREA = 28_000; // px² — prefer strict caret extraction

/**
 * Text inside the user's box only. Uses caret-range edges first so a single
 * word does not expand to the whole paragraph. Block innerText is only used
 * for large selections (e.g. product cards) where strict range may be empty.
 */
export function extractFocusText(
  rect: SelectionRect,
  elements: Element[]
): string {
  const strict = extractStrictSelectedText(rect);
  const nodeBased = extractTextInRect(rect);
  const area = rect.width * rect.height;
  const isSmall = area < SMALL_SELECTION_AREA;

  if (strict) {
    return prepareText(strict, LIMITS.focusText);
  }

  if (isSmall && nodeBased) {
    return prepareText(nodeBased, LIMITS.focusText);
  }

  if (isSmall) {
    return "";
  }

  const blocks = extractBlockTextFromElements(elements);
  const merged =
    nodeBased.length >= blocks.length * 0.6
      ? nodeBased || blocks
      : [nodeBased, blocks].filter(Boolean).join("\n");
  return prepareText(merged, LIMITS.focusText);
}
