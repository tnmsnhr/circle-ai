import type { SelectionRect } from "../types.js";
import { cleanText } from "../text/clean.js";

type CaretPoint = { node: Node; offset: number };

/** Caret at viewport point (Chrome content script). */
function caretAt(x: number, y: number): CaretPoint | null {
  const doc = document;
  if (typeof doc.caretRangeFromPoint === "function") {
    const range = doc.caretRangeFromPoint(x, y);
    if (range) {
      return { node: range.startContainer, offset: range.startOffset };
    }
  }
  const pos = doc.caretPositionFromPoint?.(x, y);
  if (pos) {
    return { node: pos.offsetNode, offset: pos.offset };
  }
  return null;
}

/**
 * Extract only the text the user boxed, using caret positions at the
 * selection edges. Avoids pulling an entire paragraph from one text node.
 */
export function extractStrictSelectedText(rect: SelectionRect): string {
  const pad = 2;
  const y = rect.top + rect.height / 2;
  const xStart = rect.left + pad;
  const xEnd = Math.max(xStart + 1, rect.right - pad);

  const start = caretAt(xStart, y);
  const end = caretAt(xEnd, y);

  if (!start || !end) return "";

  const range = document.createRange();
  try {
    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset);
  } catch {
    try {
      range.setStart(end.node, end.offset);
      range.setEnd(start.node, start.offset);
    } catch {
      return "";
    }
  }

  const text = range.toString().trim();
  return text ? cleanText(text) : "";
}
