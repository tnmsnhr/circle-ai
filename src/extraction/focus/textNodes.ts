import type { SelectionRect } from "../types.js";
import { rectsIntersect } from "../geometry/rect.js";
import { isTextElementTag, isVisible } from "../dom/visibility.js";

function nodeIntersectsRect(node: Text, rect: SelectionRect): boolean {
  const range = document.createRange();
  range.selectNodeContents(node);
  const rects = range.getClientRects();
  for (let i = 0; i < rects.length; i++) {
    if (rectsIntersect(rect, rects[i])) return true;
  }
  return false;
}

/** Text nodes visible and overlapping the selection bbox (scoped to intersecting elements). */
export function collectTextNodesInSelection(
  bbox: SelectionRect,
  roots: Element[]
): Text[] {
  const seen = new Set<Text>();
  const out: Text[] = [];

  const visitRoot = (root: Element) => {
    if (!isVisible(root)) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || !isVisible(parent)) return NodeFilter.FILTER_REJECT;
        if (!isTextElementTag(parent.tagName)) return NodeFilter.FILTER_REJECT;
        if (!node.textContent?.trim()) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let n: Node | null;
    while ((n = walker.nextNode())) {
      const textNode = n as Text;
      if (seen.has(textNode)) continue;
      if (!nodeIntersectsRect(textNode, bbox)) continue;
      seen.add(textNode);
      out.push(textNode);
    }
  };

  if (roots.length) {
    for (const el of roots) visitRoot(el);
  } else {
    visitRoot(document.body);
  }

  return out;
}
