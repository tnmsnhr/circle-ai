import type { SelectionRect } from "../types.js";
import { rectsIntersect } from "../geometry/rect.js";
import { dedupeLines, cleanText } from "../text/clean.js";
import { isTextElementTag, isVisible } from "./visibility.js";

/**
 * Extract visible text nodes whose client rects overlap the selection.
 * DOM-first; does not include off-screen cloned content.
 */
export function extractTextInRect(rect: SelectionRect): string {
  const chunks: string[] = [];
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || !isVisible(parent)) return NodeFilter.FILTER_REJECT;
        if (!isTextElementTag(parent.tagName)) return NodeFilter.FILTER_REJECT;
        const text = node.textContent?.trim();
        if (!text || text.length < 1) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    }
  );

  let node: Node | null;
  while ((node = walker.nextNode())) {
    const range = document.createRange();
    range.selectNodeContents(node);
    const rects = range.getClientRects();
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      if (rectsIntersect(rect, r)) {
        const t = node.textContent?.trim();
        if (t) chunks.push(t);
        break;
      }
    }
  }

  return dedupeLines(cleanText(chunks.join("\n")));
}

/** innerText from elements intersecting rect (blocks / cards). */
export function extractBlockTextFromElements(elements: Element[]): string {
  const parts: string[] = [];
  const seen = new Set<Element>();
  for (const el of elements) {
    if (!(el instanceof HTMLElement)) continue;
    if (seen.has(el)) continue;
    seen.add(el);
    if (!isVisible(el)) continue;
    const tag = el.tagName;
    if (!isTextElementTag(tag)) continue;
    const text = el.innerText?.trim();
    if (text && text.length > 1) parts.push(text);
  }
  return dedupeLines(cleanText(parts.join("\n")));
}
