import type { ExtractedLink, SelectionRect } from "../types.js";
import { LIMITS, CONTEXT_EXPAND_PX } from "../constants.js";
import { expandRect } from "../geometry/rect.js";
import { extractTextInRect } from "../dom/text.js";
import { prepareText } from "../text/clean.js";
import { getElementsIntersectingRect } from "../dom/elements.js";
import { filterPageElements } from "../dom/pageHitTest.js";
import { isVisible } from "../dom/visibility.js";

function metaDescription(): string | undefined {
  const el = document.querySelector(
    'meta[name="description"], meta[property="og:description"]'
  );
  return el?.getAttribute("content")?.trim() || undefined;
}

function pageH1(): string | undefined {
  return document.querySelector("h1")?.textContent?.trim() || undefined;
}

/** Nearest headings above / around the selection center. */
function headingsNear(rect: SelectionRect): string[] {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const headings: Array<{ el: Element; dist: number; text: string }> = [];

  document.querySelectorAll("h1,h2,h3,h4,h5,h6").forEach((el) => {
    if (!isVisible(el)) return;
    const box = el.getBoundingClientRect();
    const dist = Math.hypot(
      cx - (box.left + box.width / 2),
      cy - (box.top + box.height / 2)
    );
    const text = el.textContent?.trim();
    if (text) headings.push({ el, dist, text });
  });

  headings.sort((a, b) => a.dist - b.dist);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const h of headings) {
    const key = h.text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(h.text);
    if (out.length >= LIMITS.maxHeadings) break;
  }
  return out;
}

function captionsNear(elements: Element[]): string[] {
  const caps: string[] = [];
  const seen = new Set<string>();
  for (const el of elements) {
    const figure = el.closest("figure");
    const cap = figure?.querySelector("figcaption")?.textContent?.trim();
    if (cap && !seen.has(cap)) {
      seen.add(cap);
      caps.push(cap);
      if (caps.length >= LIMITS.maxCaptions) break;
    }
  }
  return caps;
}

function linksNear(expanded: SelectionRect): ExtractedLink[] {
  const links: ExtractedLink[] = [];
  const seen = new Set<string>();
  const els = getElementsIntersectingRect(expanded);
  for (const el of els) {
    const a =
      el.closest("a[href]") ||
      (el.tagName === "A" ? el : null);
    if (!(a instanceof HTMLAnchorElement)) continue;
    const href = a.href;
    const text = a.textContent?.trim() || href;
    const key = `${href}|${text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    links.push({ text, href });
    if (links.length >= LIMITS.maxLinks) break;
  }
  return links;
}

function tableHeadersNear(elements: Element[]): string[] {
  const headers: string[] = [];
  const seen = new Set<string>();
  for (const el of elements) {
    const table = el.closest("table");
    if (!table) continue;
    table.querySelectorAll("th").forEach((th) => {
      const t = th.textContent?.trim();
      if (t && !seen.has(t)) {
        seen.add(t);
        headers.push(t);
      }
    });
    if (headers.length >= 8) break;
  }
  return headers;
}

/** Walk up from center point for container / card context. */
function ancestorTextFromRect(rect: SelectionRect): string {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const stack = filterPageElements(document.elementsFromPoint(cx, cy));
  const parts: string[] = [];

  for (const el of stack) {
    if (!(el instanceof HTMLElement)) continue;
    if (el === document.body || el === document.documentElement) break;
    const tag = el.tagName;
    if (["SCRIPT", "STYLE", "NOSCRIPT"].includes(tag)) continue;
    const role = el.getAttribute("role");
    const isContainer =
      role === "article" ||
      role === "main" ||
      role === "dialog" ||
      ["ARTICLE", "SECTION", "MAIN", "ASIDE", "LI", "TD", "TR"].includes(tag);
    if (!isContainer && parts.length > 0) continue;
    const text = el.innerText?.trim();
    if (text && text.length > 20) {
      parts.push(text);
      if (parts.length >= 3) break;
    }
  }

  return prepareText(parts.join("\n\n"), LIMITS.ancestorText);
}

export interface PageContextBundle {
  nearbyText: string;
  ancestorText: string;
  headings: string[];
  captions: string[];
  links: ExtractedLink[];
  tableHeaders: string[];
  pageTitle: string;
  metaDescription?: string;
  h1?: string;
}

export function extractSurroundingContext(
  rect: SelectionRect,
  focusElements: Element[]
): PageContextBundle {
  const viewport = {
    width: window.innerWidth,
    height: window.innerHeight,
  };
  const expanded = expandRect(rect, CONTEXT_EXPAND_PX, viewport);
  const nearbyRaw = extractTextInRect(expanded);
  const expandedEls = getElementsIntersectingRect(expanded);

  return {
    nearbyText: prepareText(nearbyRaw, LIMITS.nearbyText),
    ancestorText: ancestorTextFromRect(rect),
    headings: headingsNear(rect),
    captions: captionsNear(focusElements),
    links: linksNear(expanded),
    tableHeaders: tableHeadersNear([...focusElements, ...expandedEls]),
    pageTitle: document.title || "",
    metaDescription: metaDescription(),
    h1: pageH1(),
  };
}
