import type { ExtractedImageMeta, ExtractedPdfMeta, ExtractedSvgMeta, SelectionRect } from "../types.js";
import { LIMITS } from "../constants.js";
import { classifyElement, isPartialElementSelection, isPdfLike } from "../dom/elements.js";
import { cleanText, truncate } from "../text/clean.js";

function figcaptionFor(el: Element): string | undefined {
  const figure = el.closest("figure");
  const cap = figure?.querySelector("figcaption");
  const text = cap?.textContent?.trim();
  return text || undefined;
}

function imgSrc(el: HTMLImageElement): string {
  return el.currentSrc || el.src || "";
}

export function extractImages(
  elements: Element[],
  rect: SelectionRect
): ExtractedImageMeta[] {
  const out: ExtractedImageMeta[] = [];
  const seen = new Set<string>();

  for (const el of elements) {
    const imgs: HTMLImageElement[] = [];
    if (el instanceof HTMLImageElement) imgs.push(el);
    if (el.tagName === "PICTURE") {
      el.querySelectorAll("img").forEach((img) => imgs.push(img));
    }
    for (const img of imgs) {
      const src = imgSrc(img);
      if (!src || seen.has(src)) continue;
      seen.add(src);
      out.push({
        src,
        alt: img.alt || "",
        title: img.title || "",
        figcaption: figcaptionFor(img),
        isPartialSelection: isPartialElementSelection(rect, img),
      });
      if (out.length >= LIMITS.maxImages) return out;
    }
  }
  return out;
}

export function extractSvgs(elements: Element[]): ExtractedSvgMeta[] {
  const out: ExtractedSvgMeta[] = [];
  for (const el of elements) {
    if (el.tagName !== "svg") continue;
    const title = el.querySelector("title")?.textContent?.trim();
    const desc = el.querySelector("desc")?.textContent?.trim();
    const text = el.textContent?.trim();
    let outerHTML: string | undefined;
    if (el.parentElement && el.getBoundingClientRect().width < 800) {
      outerHTML = truncate(el.outerHTML, LIMITS.svgOuterHtml);
    }
    out.push({
      title: title || undefined,
      desc: desc || undefined,
      text: text ? truncate(cleanText(text), LIMITS.svgText) : undefined,
      outerHTML,
    });
    if (out.length >= LIMITS.maxSvgs) break;
  }
  return out;
}

export function extractPdfHint(
  elements: Element[],
  selectedText: string,
  nearbyText: string
): ExtractedPdfMeta | undefined {
  const pdfEl = elements.find((el) => isPdfLike(el) || classifyElement(el) === "pdf");
  if (!pdfEl) return undefined;
  return {
    selectedText: selectedText || undefined,
    nearbyText: nearbyText || undefined,
    // pageNumber: reserved for future PDF.js integration
  };
}

export function detectElementTypes(elements: Element[]): string[] {
  const types = new Set<string>();
  for (const el of elements) {
    types.add(classifyElement(el));
  }
  return [...types].sort();
}
