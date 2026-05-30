import type { SelectionRect } from "./types.js";

export interface LocalDomExtraction {
  selectedText: string;
  textSnippet: string;
  elementTags: string[];
  linkTexts: string[];
  wordCount: number;
}

function rectsOverlap(
  a: SelectionRect,
  b: { left: number; top: number; right: number; bottom: number }
): boolean {
  return !(
    a.right < b.left ||
    a.left > b.right ||
    a.bottom < b.top ||
    a.top > b.bottom
  );
}

function truncate(s: string, max: number): string {
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

/** Read visible text nodes whose layout box intersects the lasso bounding rect. */
export function extractLocalFromRect(rect: SelectionRect): LocalDomExtraction {
  const textParts: string[] = [];
  const tags = new Set<string>();
  const linkTexts: string[] = [];
  const seen = new Set<string>();

  const root = document.body;
  if (!root) {
    return {
      selectedText: "",
      textSnippet: "",
      elementTags: [],
      linkTexts: [],
      wordCount: 0,
    };
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      const style = window.getComputedStyle(parent);
      if (
        style.visibility === "hidden" ||
        style.display === "none" ||
        style.opacity === "0"
      ) {
        return NodeFilter.FILTER_REJECT;
      }
      const raw = node.textContent?.replace(/\s+/g, " ").trim() ?? "";
      if (!raw) return NodeFilter.FILTER_REJECT;
      const range = document.createRange();
      range.selectNodeContents(node);
      const box = range.getBoundingClientRect();
      if (box.width < 1 && box.height < 1) return NodeFilter.FILTER_REJECT;
      if (!rectsOverlap(rect, box)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let node: Node | null = walker.nextNode();
  while (node) {
    const text = node.textContent?.replace(/\s+/g, " ").trim() ?? "";
    if (text && !seen.has(text)) {
      seen.add(text);
      textParts.push(text);
      const parent = node.parentElement;
      if (parent?.tagName) tags.add(parent.tagName.toLowerCase());
      const link = parent?.closest("a");
      if (link) {
        const label = link.textContent?.replace(/\s+/g, " ").trim();
        if (label) linkTexts.push(truncate(label, 120));
      }
    }
    node = walker.nextNode();
  }

  const selectedText = textParts.join("\n").slice(0, 12_000);
  const words = selectedText.trim() ? selectedText.trim().split(/\s+/).length : 0;

  return {
    selectedText,
    textSnippet: truncate(selectedText, 280),
    elementTags: [...tags].slice(0, 24),
    linkTexts: [...new Set(linkTexts)].slice(0, 8),
    wordCount: words,
  };
}
