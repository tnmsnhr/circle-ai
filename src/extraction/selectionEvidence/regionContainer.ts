import type { SelectionRect } from "../types.js";
import { rectsIntersect, intersectionArea } from "../geometry/rect.js";
import { pageElementFromPoint } from "../dom/pageHitTest.js";
import { isVisible } from "../dom/visibility.js";

const CONTAINER_TAGS = new Set([
  "ARTICLE",
  "SECTION",
  "HEADER",
  "MAIN",
  "ASIDE",
  "NAV",
  "FORM",
  "FIGURE",
]);

const CONTAINER_ROLES = new Set([
  "banner",
  "region",
  "dialog",
  "complementary",
  "main",
  "article",
  "navigation",
]);

const CONTAINER_CLASS_RE =
  /\b(card|panel|header|hero|profile|tile|modal|sidebar|toolbar|banner|section|content-region|masthead)\b/i;

export function findSelectionContainer(
  rect: SelectionRect,
  elements: Element[]
): Element | null {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const center = pageElementFromPoint(cx, cy);

  const candidates: Element[] = [];
  const seen = new Set<Element>();

  const consider = (el: Element | null) => {
    if (!el || seen.has(el) || !isVisible(el)) return;
    if (!rectsIntersect(rect, el.getBoundingClientRect())) return;
    seen.add(el);
    candidates.push(el);
  };

  if (center) {
    for (let el: Element | null = center; el && el !== document.body; el = el.parentElement) {
      consider(el);
    }
  }

  for (const el of elements) {
    consider(el);
    let p = el.parentElement;
    for (let d = 0; p && d < 4; d++) {
      consider(p);
      p = p.parentElement;
    }
  }

  let best: Element | null = null;
  let bestScore = -Infinity;

  for (const el of candidates) {
    const tag = el.tagName;
    const role = (el.getAttribute("role") || "").toLowerCase();
    const classHint = `${el.className ?? ""}`.toLowerCase();

    const isContainer =
      CONTAINER_TAGS.has(tag) ||
      CONTAINER_ROLES.has(role) ||
      CONTAINER_CLASS_RE.test(classHint);

    if (!isContainer) continue;

    const box = el.getBoundingClientRect();
    const elArea = Math.max(1, box.width * box.height);
    const overlap = intersectionArea(rect, box) / Math.max(1, rect.width * rect.height);
    const containsCenter =
      cx >= box.left &&
      cx <= box.right &&
      cy >= box.top &&
      cy <= box.bottom;

    let score = overlap * 50;
    if (containsCenter) score += 30;
    score -= Math.min(40, elArea / 25_000);
    if (tag === "HEADER" || role === "banner") score += 8;
    if (/\b(profile|header|card|hero)\b/.test(classHint)) score += 6;

    if (score > bestScore) {
      bestScore = score;
      best = el;
    }
  }

  return best;
}

/** Generic region type label from DOM signals only. */
export function inferRegionTypeLabel(container: Element | null): string {
  if (!container) return "selected content region";

  const tag = container.tagName;
  const role = (container.getAttribute("role") || "").toLowerCase();
  const hint = `${container.className ?? ""}`.toLowerCase();

  if (role === "dialog" || /\bmodal\b/.test(hint)) return "dialog region";
  if (tag === "HEADER" || role === "banner" || /\b(header|masthead|hero)\b/.test(hint)) {
    return "header region";
  }
  if (/\bprofile\b/.test(hint)) return "profile region";
  if (/\b(card|tile|panel)\b/.test(hint)) return "card region";
  if (tag === "NAV" || role === "navigation" || /\btoolbar\b/.test(hint)) {
    return "toolbar region";
  }
  if (tag === "ASIDE" || role === "complementary" || /\bsidebar\b/.test(hint)) {
    return "sidebar region";
  }
  if (tag === "TABLE" || container.querySelector("table")) return "table region";
  if (tag === "FORM") return "form region";

  return "selected UI region";
}

export function nearestHeadingInContainer(container: Element): string | undefined {
  const headings = container.querySelectorAll("h1,h2,h3,h4,h5,h6,[role=heading]");
  for (const h of headings) {
    if (!isVisible(h)) continue;
    const t = h.textContent?.trim();
    if (t && t.length <= 120) return t;
  }
  return undefined;
}
