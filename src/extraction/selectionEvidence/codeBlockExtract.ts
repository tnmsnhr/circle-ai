import type { FocusExtractionContext } from "../focus/types.js";
import type { ExtractionCandidate as InternalCandidate } from "../focus/types.js";
import type { SelectionRect } from "../types.js";
import { intersectionArea, rectsIntersect } from "../geometry/rect.js";
import { hitsPolygon } from "../focus/geometry.js";
import { pageElementFromPoint } from "../dom/pageHitTest.js";
import { isVisible } from "../dom/visibility.js";
import { looksCodeLike } from "../selectionShape.js";

const CODE_TAGS = new Set(["PRE", "CODE", "SAMP", "KBD"]);

export interface CodeContainerMatch {
  element: HTMLElement;
  overlapRatio: number;
  isMonospace: boolean;
}

function isMonospaceElement(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const style = window.getComputedStyle(el);
  const font = style.fontFamily.toLowerCase();
  return (
    font.includes("mono") ||
    font.includes("consolas") ||
    font.includes("menlo") ||
    font.includes("courier")
  );
}

function isCodeTag(el: Element): boolean {
  return CODE_TAGS.has(el.tagName);
}

/** Find the best pre/code container overlapping the selection. */
export function findCodeContainer(
  ctx: FocusExtractionContext,
  elements: Element[]
): CodeContainerMatch | null {
  const candidates: CodeContainerMatch[] = [];
  const seen = new Set<Element>();

  const consider = (el: Element | null) => {
    if (!el || seen.has(el) || !(el instanceof HTMLElement)) return;
    if (!isVisible(el)) return;

    let codeEl: HTMLElement | null = null;
    if (isCodeTag(el)) codeEl = el;
    else {
      const inner = el.closest("pre,code,samp,kbd");
      if (inner instanceof HTMLElement) codeEl = inner;
    }

    if (!codeEl || seen.has(codeEl)) return;
    seen.add(codeEl);

    const box = codeEl.getBoundingClientRect();
    if (!rectsIntersect(ctx.bbox, box)) return;

    const containerArea = Math.max(1, box.width * box.height);
    const overlap = intersectionArea(ctx.bbox, box);
    const overlapRatio = overlap / containerArea;
    const selOverlap = overlap / Math.max(1, ctx.selectionArea);

    if (overlapRatio < 0.08 && selOverlap < 0.15) return;

    candidates.push({
      element: codeEl,
      overlapRatio: Math.max(overlapRatio, selOverlap),
      isMonospace: isMonospaceElement(codeEl) || isCodeTag(codeEl),
    });
  };

  const center = pageElementFromPoint(ctx.lassoCenter.x, ctx.lassoCenter.y);
  if (center) {
    for (let el: Element | null = center; el && el !== document.body; el = el.parentElement) {
      consider(el);
    }
  }

  for (const el of elements) {
    consider(el);
    if (el.parentElement) consider(el.parentElement);
  }

  document.querySelectorAll("pre,code").forEach((el) => consider(el));

  if (!candidates.length) return null;

  candidates.sort((a, b) => {
    const mono = (b.isMonospace ? 1 : 0) - (a.isMonospace ? 1 : 0);
    if (mono !== 0) return mono;
    return b.overlapRatio - a.overlapRatio;
  });

  return candidates[0] ?? null;
}

function rectHitsSelection(rect: DOMRect, ctx: FocusExtractionContext): boolean {
  const r = {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  };
  const hit = hitsPolygon(r, ctx.polygon, ctx.bbox);
  return hit.centerInside || hit.intersects;
}

/** Preserve indentation; normalize line endings only. */
export function preserveCodeText(text: string, maxLen = 12_000): string {
  let t = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (t.length > maxLen) t = `${t.slice(0, maxLen)}…`;
  return t;
}

/**
 * Extract line-preserved code text for lines whose boxes intersect the selection.
 */
export function extractSelectedCodeText(
  container: HTMLElement,
  ctx: FocusExtractionContext
): { text: string; lineCount: number } {
  const lineMap = new Map<number, string>();

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || !isVisible(parent)) return NodeFilter.FILTER_REJECT;
      if (!node.textContent) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let node: Node | null;
  while ((node = walker.nextNode())) {
    const textNode = node as Text;
    const content = textNode.textContent ?? "";
    if (!content) continue;

    const parts = content.split("\n");
    let offset = 0;

    for (let li = 0; li < parts.length; li++) {
      const segment = parts[li]!;
      const segLen = segment.length;

      if (segLen > 0) {
        const range = document.createRange();
        try {
          range.setStart(textNode, offset);
          range.setEnd(textNode, offset + segLen);
        } catch {
          offset += segLen + 1;
          continue;
        }

        const rects = range.getClientRects();
        let hits = false;
        let lineY = 0;
        for (let i = 0; i < rects.length; i++) {
          if (rectHitsSelection(rects[i], ctx)) {
            hits = true;
            lineY = rects[i].top + rects[i].height / 2;
            break;
          }
        }

        if (hits) {
          const key = Math.round(lineY / 4);
          const prev = lineMap.get(key);
          lineMap.set(key, prev != null ? prev + segment : segment);
        }
      }

      offset += segLen + (li < parts.length - 1 ? 1 : 0);
    }
  }

  const lines = [...lineMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, text]) => text);

  const text = preserveCodeText(lines.join("\n"));
  return { text, lineCount: lines.length };
}

export function countTokensInContainer(
  ranked: InternalCandidate[],
  container: HTMLElement,
  bbox: SelectionRect
): number {
  const box = container.getBoundingClientRect();
  let n = 0;
  for (const c of ranked) {
    if (c.type !== "text-token" && c.type !== "text-range") continue;
    const cx = c.rect.left + c.rect.width / 2;
    const cy = c.rect.top + c.rect.height / 2;
    if (
      cx >= box.left &&
      cx <= box.right &&
      cy >= box.top &&
      cy <= box.bottom &&
      rectsIntersect(bbox, c.rect as DOMRect)
    ) {
      n++;
    }
  }
  return n;
}

export function buildCodeBlockCandidate(
  container: HTMLElement,
  codeText: string,
  ctx: FocusExtractionContext
): InternalCandidate {
  const box = container.getBoundingClientRect();
  return {
    type: "code-block",
    text: codeText,
    rect: {
      left: box.left,
      top: box.top,
      right: box.right,
      bottom: box.bottom,
      width: box.width,
      height: box.height,
    },
    element: container,
    score: 120,
    confidence: 0.92,
    reasonCodes: [
      "large-selection",
      "code-block",
      "monospace",
      "multi-line-code",
    ],
    metadata: { codeContainer: container.tagName.toLowerCase() },
  };
}

export function sampleLooksCodeLike(text: string): boolean {
  const sample = text.slice(0, 800);
  if (looksCodeLike(sample)) return true;
  if (/[=<>()[\]{};:]|->|=>|:=|==|!=|\|\||&&/.test(sample)) return true;
  if (/^\s{2,}\S/m.test(sample)) return true;
  if ((sample.match(/\n/g)?.length ?? 0) >= 3) return true;
  return false;
}
