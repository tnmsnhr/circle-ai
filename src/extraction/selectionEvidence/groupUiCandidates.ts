import type { FocusExtractionContext } from "../focus/types.js";
import type { ExtractionCandidate as InternalCandidate } from "../focus/types.js";
import type { SelectionRect } from "../types.js";
import { rectsIntersect, intersectionArea } from "../geometry/rect.js";
import { isVisible } from "../dom/visibility.js";
import {
  normalizeCandidateText,
  rejectNoisyMergedCandidate,
} from "./candidateTextCleanup.js";
import { classifyUiRole, type CandidateUiRole } from "./uiRole.js";
import {
  findSelectionContainer,
  inferRegionTypeLabel,
  nearestHeadingInContainer,
} from "./regionContainer.js";

const CONTROL_SELECTOR =
  "h1,h2,h3,h4,h5,h6,[role=heading],button,a[href],input,select,textarea,label,[role=button],[role=tab],[role=link],summary";

function controlText(el: Element): string {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    return (el.value || el.placeholder || "").trim();
  }
  const aria =
    el.getAttribute("aria-label") ||
    el.getAttribute("title") ||
    el.getAttribute("alt");
  if (aria?.trim()) return normalizeCandidateText(aria);
  return normalizeCandidateText(el.textContent ?? "");
}

function rectFromElement(el: Element): InternalCandidate["rect"] {
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

function intersectsSelection(
  el: Element,
  rect: SelectionRect,
  minOverlap = 0.25
): boolean {
  const box = el.getBoundingClientRect();
  if (!rectsIntersect(rect, box)) return false;
  const elArea = Math.max(1, box.width * box.height);
  const overlap = intersectionArea(rect, box);
  return overlap / elArea >= minOverlap;
}

function scoreRoleCandidate(
  role: CandidateUiRole,
  el: Element,
  ctx: FocusExtractionContext
): number {
  let score = 40;
  const box = el.getBoundingClientRect();
  const cy = box.top + box.height / 2;
  const dist = Math.hypot(
    box.left + box.width / 2 - ctx.lassoCenter.x,
    cy - ctx.lassoCenter.y
  );
  score -= dist * 0.04;

  switch (role) {
    case "heading":
      score += 35;
      break;
    case "button":
    case "link":
      score += 28;
      break;
    case "tab":
      score += 24;
      break;
    case "status":
    case "metadata":
      score += 18;
      break;
    case "image":
    case "avatar":
      score += 12;
      break;
    default:
      score += 8;
  }

  return score;
}

export interface GroupedUiResult {
  regionCandidate?: InternalCandidate;
  grouped: InternalCandidate[];
  container: Element | null;
  regionTypeLabel: string;
}

/**
 * Build region + per-control candidates for large UI selections.
 * Uses element boundaries — does not glue token strings.
 */
export function buildGroupedUiCandidates(
  ctx: FocusExtractionContext,
  elements: Element[],
  ranked: InternalCandidate[]
): GroupedUiResult {
  const container =
    findSelectionContainer(ctx.bbox, elements) ?? null;
  const regionTypeLabel = inferRegionTypeLabel(container);
  const heading =
    (container && nearestHeadingInContainer(container)) ||
    ranked.find((c) => c.text && classifyUiRole(c.element) === "heading")?.text;

  const regionLabel = heading
    ? `${heading} · ${regionTypeLabel}`
    : regionTypeLabel;

  const regionCandidate: InternalCandidate = {
    type: "region",
    text: normalizeCandidateText(regionLabel),
    rect: container
      ? rectFromElement(container)
      : {
          left: ctx.bbox.left,
          top: ctx.bbox.top,
          right: ctx.bbox.right,
          bottom: ctx.bbox.bottom,
          width: ctx.bbox.width,
          height: ctx.bbox.height,
        },
    element: container ?? undefined,
    score: 72,
    confidence: 0.75,
    reasonCodes: [
      "large-selection",
      "region-candidate",
      container ? "contains-heading" : "selected-container",
    ],
    metadata: { regionType: regionTypeLabel, uiRole: "region" },
  };

  const root = container ?? document.body;
  const controls = root.querySelectorAll(CONTROL_SELECTOR);
  const seenText = new Set<string>();
  const grouped: InternalCandidate[] = [];

  for (const el of controls) {
    if (!isVisible(el)) continue;
    if (!intersectsSelection(el, ctx.bbox, 0.2)) continue;

    const text = controlText(el);
    if (!text || text.length < 2 || text.length > 160) continue;
    if (rejectNoisyMergedCandidate(text)) continue;

    const key = text.toLowerCase();
    if (seenText.has(key)) continue;
    seenText.add(key);

    const uiRole = classifyUiRole(el);
    const reasons = ["grouped-control", "inside-selection", `ui-role-${uiRole}`];
    if (uiRole === "heading") reasons.push("contains-heading");
    if (uiRole === "button" || uiRole === "link") reasons.push("contains-actions");
    if (uiRole === "tab") reasons.push("contains-tabs");
    if (uiRole === "metadata" || uiRole === "status") reasons.push("contains-metadata");

    grouped.push({
      type: "text-fragment",
      text,
      rect: rectFromElement(el),
      element: el,
      score: scoreRoleCandidate(uiRole, el, ctx),
      confidence: 0.7,
      reasonCodes: reasons,
      metadata: { uiRole },
    });
  }

  grouped.sort((a, b) => b.score - a.score);

  const maxPerRole = 2;
  const roleCounts = new Map<string, number>();
  const capped: InternalCandidate[] = [];

  for (const c of grouped) {
    const role = (c.metadata?.uiRole as string) ?? "unknown";
    const n = roleCounts.get(role) ?? 0;
    if (n >= maxPerRole) continue;
    roleCounts.set(role, n + 1);
    capped.push(c);
    if (capped.length >= 7) break;
  }

  return {
    regionCandidate,
    grouped: capped,
    container,
    regionTypeLabel,
  };
}
