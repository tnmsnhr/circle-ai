import type { SelectionRect } from "../types.js";
import { intersectionArea, rectsIntersect, elementBox } from "../geometry/rect.js";
import { filterPageElements } from "./pageHitTest.js";
import { isVisible } from "./visibility.js";

const MEDIA_SELECTOR =
  "img,picture,svg,canvas,video,object,embed,iframe,table,figure,[role='img']";

/**
 * Collect DOM elements overlapping the selection using point sampling + media query.
 * Avoids walking the entire document tree.
 */
export function getElementsIntersectingRect(
  rect: SelectionRect,
  root: Document | Element = document
): Element[] {
  const seen = new Set<Element>();
  const result: Element[] = [];

  const add = (el: Element | null | undefined) => {
    if (!el || !(el instanceof Element)) return;
    if (el === document.documentElement || el === document.body) return;
    if (seen.has(el)) return;
    if (!isVisible(el)) return;
    const box = elementBox(el);
    if (!rectsIntersect(rect, box)) return;
    seen.add(el);
    result.push(el);
  };

  const steps = Math.min(5, Math.max(2, Math.ceil(Math.sqrt(rect.width * rect.height) / 80)));
  for (let ix = 0; ix <= steps; ix++) {
    for (let iy = 0; iy <= steps; iy++) {
      const x = rect.left + (rect.width * ix) / steps;
      const y = rect.top + (rect.height * iy) / steps;
      const stack = filterPageElements(document.elementsFromPoint(x, y));
      for (const el of stack) {
        add(el);
        if (el.parentElement) add(el.parentElement);
      }
    }
  }

  root.querySelectorAll(MEDIA_SELECTOR).forEach((el) => add(el));

  return result;
}

/** Classify element for focus.elementTypes and strategy. */
export function classifyElement(el: Element): string {
  const tag = el.tagName.toLowerCase();
  if (tag === "img" || tag === "picture") return "image";
  if (tag === "svg") return "svg";
  if (tag === "canvas") return "canvas";
  if (tag === "video") return "video";
  if (tag === "table") return "table";
  if (isPdfLike(el)) return "pdf";
  if (tag === "figure") return "figure";
  return tag;
}

export function isPdfLike(el: Element): boolean {
  if (el.tagName === "EMBED" || el.tagName === "OBJECT") {
    const type = (el.getAttribute("type") || "").toLowerCase();
    if (type.includes("pdf")) return true;
  }
  if (el.tagName === "IFRAME") {
    const src = (el.getAttribute("src") || "").toLowerCase();
    return src.includes(".pdf") || src.includes("pdf");
  }
  return false;
}

export function isPartialElementSelection(
  rect: SelectionRect,
  el: Element
): boolean {
  const box = elementBox(el);
  const overlap = intersectionArea(rect, box);
  const elArea = Math.max(1, box.width * box.height);
  return overlap > 0 && overlap / elArea < 0.85;
}
