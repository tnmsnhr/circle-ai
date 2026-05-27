import type { ExtractedContext } from "../types.js";
import type { SelectionRect } from "../types.js";
import { pageElementFromPoint } from "../dom/pageHitTest.js";
import { isVisible } from "../dom/visibility.js";
import {
  findContentContainer,
  firstParagraphAfterHeading,
  isChromeContainer,
  isTableOfContents,
} from "./contextBoundaries.js";
import { normalizeCandidateText } from "./candidateTextCleanup.js";
import { rectsIntersect } from "../geometry/rect.js";

const HEADING_TAGS = new Set(["H1", "H2", "H3", "H4", "H5", "H6"]);

export function findHeadingElementNearSelection(
  headingText: string,
  rect: SelectionRect
): Element | null {
  const norm = normalizeCandidateText(headingText).toLowerCase();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const center = pageElementFromPoint(cx, cy);

  if (center) {
    for (let el: Element | null = center; el && el !== document.body; el = el.parentElement) {
      if (!HEADING_TAGS.has(el.tagName) && el.getAttribute("role") !== "heading") continue;
      if (!isVisible(el)) continue;
      if (isChromeContainer(el) || isTableOfContents(el)) continue;
      const t = normalizeCandidateText(el.textContent ?? "").toLowerCase();
      if (t === norm || t.includes(norm)) return el;
    }
  }

  for (const el of document.querySelectorAll("h1,h2,h3,h4,h5,h6,[role=heading]")) {
    if (!isVisible(el)) continue;
    if (!rectsIntersect(rect, el.getBoundingClientRect())) continue;
    if (isChromeContainer(el) || isTableOfContents(el)) continue;
    const t = normalizeCandidateText(el.textContent ?? "").toLowerCase();
    if (t === norm || t.includes(norm)) return el;
  }

  return null;
}

/**
 * Compact context for section heading selections: heading + first paragraph under it.
 */
export function buildSectionHeadingContext(
  extracted: ExtractedContext,
  headingText: string,
  headingEl: Element | null | undefined,
  maxChars: number
): string {
  const parts: string[] = [];
  const heading = normalizeCandidateText(headingText);
  if (heading) parts.push(`[Heading] ${heading}`);

  const resolvedEl =
    headingEl ??
    findHeadingElementNearSelection(headingText, extracted.meta.selectionRect);

  let nearby: string | undefined;
  if (resolvedEl) {
    const container =
      findContentContainer(resolvedEl) ??
      resolvedEl.closest("article,main,section");
    if (container && !isChromeContainer(container)) {
      nearby = firstParagraphAfterHeading(resolvedEl, container);
    }
  }

  if (!nearby && extracted.context.metaDescription?.trim()) {
    const meta = extracted.context.metaDescription.trim();
    if (meta.length >= 40 && !meta.toLowerCase().startsWith(heading.toLowerCase())) {
      nearby = meta;
    }
  }

  if (nearby) {
    parts.push(`[Nearby] ${normalizeCandidateText(nearby)}`);
  }

  const block = parts.join("\n");
  return block.length <= maxChars ? block : `${block.slice(0, maxChars)}…`;
}
