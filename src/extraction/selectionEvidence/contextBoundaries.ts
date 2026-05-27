import { isVisible } from "../dom/visibility.js";

const CHROME_TAGS = new Set(["NAV", "FOOTER", "ASIDE", "HEADER"]);
const CHROME_ROLES = new Set([
  "navigation",
  "banner",
  "contentinfo",
  "complementary",
  "menubar",
  "toolbar",
]);

const CHROME_CLASS_RE =
  /\b(nav|navbar|navigation|sidebar|side-bar|footer|site-footer|header|masthead|toolbar|toc|table-of-contents|contents|appearance|skin|jump-to|jump-to-nav|vector-toc|sidebar-toc)\b/i;

const TOC_CLASS_RE =
  /\b(toc|table-of-contents|contents|sidebar-toc|vector-toc|jump-to)\b/i;

const CHROME_TEXT_RE =
  /^\s*(\[(edit|hide|show|citation needed)\]|edit\s*section|hide|show)\s*$/i;

/** Remove common UI chrome markers from extracted candidate text. */
export function stripChromeText(text: string): string {
  let t = text ?? "";
  // Remove standalone leading markers like "[edit]" or "hide/show" or "citation needed".
  t = t.replace(/\s*\[(edit|hide|show|citation needed)\]\s*/gi, " ");
  t = t.replace(
    /^\s*(edit|hide|show|citation needed)\b\s*[:\-]?\s*/i,
    " "
  );
  // Remove embedded "[edit]" style markers.
  t = t.replace(/\[(edit|hide|show|citation needed)\]\s*/gi, " ");
  // Remove "hide/show" and "show/hide" sequences.
  t = t.replace(/\bhide\s*\/\s*show\b/gi, " ");
  t = t.replace(/\bshow\s*\/\s*hide\b/gi, " ");
  return t.trim().replace(/\s+/g, " ");
}

/** Mechanical chrome zones — not semantic page understanding. */
export function isChromeContainer(el: Element | null | undefined): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  let cur: Element | null = el;
  for (let d = 0; cur && d < 10; d++) {
    const tag = cur.tagName;
    const role = (cur.getAttribute("role") || "").toLowerCase();
    const hint = `${cur.id ?? ""} ${cur.className ?? ""}`.toLowerCase();
    if (CHROME_TAGS.has(tag) && tag !== "HEADER") return true;
    if (tag === "HEADER" && /\b(site-header|global-header|page-header)\b/.test(hint)) {
      return true;
    }
    if (CHROME_ROLES.has(role)) return true;
    if (CHROME_CLASS_RE.test(hint)) return true;
    cur = cur.parentElement;
  }
  return false;
}

export function isTableOfContents(el: Element | null | undefined): boolean {
  if (!el) return false;
  let cur: Element | null = el;
  for (let d = 0; cur && d < 8; d++) {
    const hint = `${cur.id ?? ""} ${cur.className ?? ""}`.toLowerCase();
    const role = (cur.getAttribute("role") || "").toLowerCase();
    if (TOC_CLASS_RE.test(hint)) return true;
    if (role === "navigation" && TOC_CLASS_RE.test(hint)) return true;
    cur = cur.parentElement;
  }
  return false;
}

export function isChromeText(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > 40) return false;
  return CHROME_TEXT_RE.test(t);
}

/** Closest article/main/section content container, skipping chrome. */
export function findContentContainer(startEl: Element | null): Element | null {
  if (!startEl) return null;
  let cur: Element | null = startEl;
  let fallback: Element | null = null;

  for (let d = 0; cur && cur !== document.body; d++) {
    if (!isVisible(cur)) {
      cur = cur.parentElement;
      continue;
    }
    if (isChromeContainer(cur) || isTableOfContents(cur)) {
      cur = cur.parentElement;
      continue;
    }

    const tag = cur.tagName;
    const role = (cur.getAttribute("role") || "").toLowerCase();
    if (tag === "ARTICLE" || role === "article") return cur;
    if (tag === "MAIN" || role === "main") return cur;
    if (tag === "SECTION" && !fallback) fallback = cur;
    if (tag === "FIGURE") return cur;

    cur = cur.parentElement;
  }

  return fallback;
}

const BLOCK_TAGS = new Set([
  "P",
  "DIV",
  "LI",
  "DD",
  "BLOCKQUOTE",
  "FIGCAPTION",
  "TD",
]);

/** First meaningful paragraph block after a heading within a container. */
export function firstParagraphAfterHeading(
  headingEl: Element,
  container: Element
): string | undefined {
  const headingBox = headingEl.getBoundingClientRect();
  const candidates: Array<{ el: Element; text: string; top: number }> = [];

  const walk = (root: Element) => {
    for (const el of root.querySelectorAll("p,div,li,dd,blockquote,figcaption")) {
      if (!isVisible(el)) continue;
      if (isChromeContainer(el) || isTableOfContents(el)) continue;
      if (el.closest("table,pre,code,nav,aside,footer")) continue;

      const box = el.getBoundingClientRect();
      if (box.top < headingBox.bottom - 4) continue;
      if (box.top - headingBox.bottom > 800) continue;

      const text = (el.textContent ?? "").trim().replace(/\s+/g, " ");
      if (text.length < 40) continue;
      if (isChromeText(text)) continue;
      if (!BLOCK_TAGS.has(el.tagName) && text.length < 80) continue;

      candidates.push({ el, text, top: box.top });
    }
  };

  walk(container);

  candidates.sort((a, b) => a.top - b.top);
  const first = candidates[0];
  if (!first) return undefined;
  return first.text.length > 480 ? `${first.text.slice(0, 480)}…` : first.text;
}
