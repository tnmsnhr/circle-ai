import type { FocusExtractionContext } from "../focus/types.js";
import type { ExtractionCandidate } from "../focus/types.js";
import { intersectionArea, rectsIntersect } from "../geometry/rect.js";
import { isVisible } from "../dom/visibility.js";
import { pageElementFromPoint } from "../dom/pageHitTest.js";
import { hitsPolygon, overlapRatioWithRect } from "../focus/geometry.js";
import { attachConfidence } from "../focus/scoreCandidate.js";
import {
  normalizeCandidateText,
  rejectNoisyMergedCandidate,
} from "./candidateTextCleanup.js";
import { classifyUiRole, type CandidateUiRole } from "./uiRole.js";
import {
  isChromeContainer,
  isChromeText,
  isTableOfContents,
  stripChromeText,
} from "./contextBoundaries.js";

const STRUCTURAL_SELECTOR =
  "h1,h2,h3,h4,h5,h6,[role=heading],button,a[href],[role=button],[role=tab],[role=link],td,th,tr,figcaption,figure,summary,caption";

const PHRASE_ROLES = new Set<CandidateUiRole>([
  "heading",
  "button",
  "link",
  "tab",
  "table-cell",
  "card",
]);

const INLINE_CODE_TAGS = new Set(["CODE", "KBD", "SAMP"]);

const MAX_PHRASE_LEN = 120;

function elementText(el: Element): string {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    const raw = el.value || el.placeholder || "";
    return normalizeCandidateText(stripChromeText(raw));
  }
  const aria =
    el.getAttribute("aria-label") ||
    el.getAttribute("title") ||
    el.getAttribute("alt");
  if (aria?.trim()) return normalizeCandidateText(stripChromeText(aria));
  return normalizeCandidateText(stripChromeText(el.textContent ?? ""));
}

function rectFromElement(el: Element): ExtractionCandidate["rect"] {
  const b = el.getBoundingClientRect();
  return {
    left: b.left,
    top: b.top,
    right: b.right,
    bottom: b.bottom,
    width: b.width,
    height: b.height,
  };
}

function selectionOverlapRatio(el: Element, ctx: FocusExtractionContext): number {
  const box = el.getBoundingClientRect();
  const elArea = Math.max(1, box.width * box.height);
  const overlap = intersectionArea(ctx.bbox, box);
  return overlap / elArea;
}

function scoreStructuralElement(
  el: Element,
  role: CandidateUiRole,
  ctx: FocusExtractionContext
): { score: number; reasonCodes: string[] } {
  const reasons: string[] = ["structural-element"];
  const box = rectFromElement(el);
  const hit = hitsPolygon(box, ctx.polygon, ctx.bbox);
  let score = 0;

  const overlap = selectionOverlapRatio(el, ctx);
  score += Math.min(55, overlap * 70);
  if (overlap >= 0.45) reasons.push("inside-selection");
  if (overlap >= 0.65) reasons.push("high-overlap");

  if (hit.centerInside) {
    score += 18;
    reasons.push("center-in-polygon");
  } else if (hit.intersects) {
    score += 12;
    reasons.push("intersects-polygon");
  }

  const polyCover = overlapRatioWithRect(box, ctx.bbox);
  score += Math.min(20, polyCover * 25);

  switch (role) {
    case "heading":
      score += 42;
      reasons.push("contains-heading");
      break;
    case "button":
    case "link":
      score += 36;
      reasons.push("contains-actions");
      break;
    case "tab":
      score += 34;
      reasons.push("contains-tabs");
      break;
    case "table-cell":
      score += 30;
      reasons.push("structured");
      break;
    case "card":
      score += 28;
      break;
    default:
      score += 20;
  }

  const text = elementText(el);
  if (text.length > 0 && text.length <= MAX_PHRASE_LEN) {
    score += 8;
    reasons.push("phrase-length-ok");
  }

  return { score, reasonCodes: reasons };
}

function mapRoleToCandidateType(role: CandidateUiRole): ExtractionCandidate["type"] {
  switch (role) {
    case "heading":
      return "heading";
    case "button":
      return "button";
    case "link":
      return "link";
    case "tab":
      return "tab";
    default:
      return "structured";
  }
}

function collectElements(ctx: FocusExtractionContext, elements: Element[]): Element[] {
  const seen = new Set<Element>();
  const out: Element[] = [];

  const add = (el: Element | null) => {
    if (!el || seen.has(el) || !isVisible(el)) return;
    if (isChromeContainer(el) || isTableOfContents(el)) return;
    seen.add(el);
    out.push(el);
  };

  const center = pageElementFromPoint(ctx.lassoCenter.x, ctx.lassoCenter.y);
  if (center) {
    for (let el: Element | null = center; el && el !== document.body; el = el.parentElement) {
      add(el);
    }
  }

  for (const el of elements) {
    add(el);
    let p = el.parentElement;
    for (let d = 0; p && d < 6; d++) {
      add(p);
      p = p.parentElement;
    }
  }

  const expanded = document.querySelectorAll(STRUCTURAL_SELECTOR);
  for (const el of expanded) {
    if (!rectsIntersect(ctx.bbox, el.getBoundingClientRect())) continue;
    add(el);
  }

  return out;
}

/** Mechanical structural candidates from DOM overlap — headings, links, buttons, tabs, table cells. */
export function collectDomStructuralCandidates(
  ctx: FocusExtractionContext,
  elements: Element[]
): ExtractionCandidate[] {
  const out: ExtractionCandidate[] = [];
  const seenText = new Set<string>();

  for (const el of collectElements(ctx, elements)) {
    const tag = el.tagName;
    if (!el.matches(STRUCTURAL_SELECTOR)) {
      const role = classifyUiRole(el);
      if (!PHRASE_ROLES.has(role)) continue;
    }

    const uiRole = classifyUiRole(el);
    if (uiRole === "unknown" || uiRole === "metadata" || uiRole === "image" || uiRole === "avatar") {
      continue;
    }

    const overlap = selectionOverlapRatio(el, ctx);
    if (overlap < 0.2 && uiRole !== "table-cell") continue;

    const text = elementText(el);
    if (!text || text.length > MAX_PHRASE_LEN) continue;
    if (rejectNoisyMergedCandidate(text) || isChromeText(text)) continue;

    const key = `${uiRole}:${text.toLowerCase()}`;
    if (seenText.has(key)) continue;
    seenText.add(key);

    const { score, reasonCodes } = scoreStructuralElement(el, uiRole, ctx);
    if (score < 30) continue;

    const candidateType = mapRoleToCandidateType(uiRole);

    out.push(
      attachConfidence({
        type: candidateType,
        text,
        rect: rectFromElement(el),
        element: el,
        metadata: { uiRole, tag: tag.toLowerCase() },
        score,
        confidence: 0,
        reasonCodes,
      })
    );
  }

  return out.sort((a, b) => b.score - a.score);
}

/** Find short parent phrase for a token element (heading, button, link, tab, inline code). */
export function findPhraseParent(
  startEl: Element | null
): { element: Element; text: string; uiRole: CandidateUiRole } | null {
  if (!startEl) return null;
  let cur: Element | null = startEl;

  for (let d = 0; cur && d < 10; d++) {
    if (isChromeContainer(cur) || isTableOfContents(cur)) return null;

    const tag = cur.tagName;
    if (INLINE_CODE_TAGS.has(tag)) {
      const text = normalizeCandidateText(stripChromeText(cur.textContent ?? ""));
      if (text && text.length <= MAX_PHRASE_LEN && !/\n/.test(text)) {
        return { element: cur, text, uiRole: "unknown" };
      }
    }

    const uiRole = classifyUiRole(cur);
    if (PHRASE_ROLES.has(uiRole)) {
      const text = elementText(cur);
      if (text && text.length <= MAX_PHRASE_LEN && !/\n/.test(text) && !isChromeText(text)) {
        return { element: cur, text, uiRole };
      }
    }

    if (tag === "FIGCAPTION" || tag === "CAPTION") {
      const text = elementText(cur);
      if (text && text.length <= MAX_PHRASE_LEN) {
        return { element: cur, text, uiRole: "unknown" };
      }
    }

    cur = cur.parentElement;
  }

  return null;
}
