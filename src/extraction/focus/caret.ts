export type CaretPoint = { node: Node; offset: number };

/** Caret at viewport point (Chrome content script). */
export function caretAt(x: number, y: number): CaretPoint | null {
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

export function rangeFromCarets(
  start: CaretPoint,
  end: CaretPoint
): Range | null {
  const range = document.createRange();
  try {
    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset);
    return range;
  } catch {
    try {
      range.setStart(end.node, end.offset);
      range.setEnd(start.node, start.offset);
      return range;
    } catch {
      return null;
    }
  }
}

export function rangeText(range: Range): string {
  return range.toString().replace(/\s+/g, " ").trim();
}

export function rangeUnionRect(range: Range): DOMRect | null {
  const rects = range.getClientRects();
  if (!rects.length) return null;
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    left = Math.min(left, r.left);
    top = Math.min(top, r.top);
    right = Math.max(right, r.right);
    bottom = Math.max(bottom, r.bottom);
  }
  if (!Number.isFinite(left)) return null;
  return new DOMRect(left, top, right - left, bottom - top);
}
