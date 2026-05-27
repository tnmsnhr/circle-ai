import type { FocusExtractionContext } from "../focus/types.js";
import type { ExtractionCandidate } from "../focus/types.js";
import { intersectionArea } from "../geometry/rect.js";
import { classifySelectionSize } from "./selectionSize.js";

export interface SectionHeadingSignals {
  isSectionHeading: boolean;
  headingCandidate?: ExtractionCandidate;
}

function headingOverlap(
  heading: ExtractionCandidate,
  ctx: FocusExtractionContext
): number {
  if (!heading.rect) return 0;
  const elArea = Math.max(1, heading.rect.width * heading.rect.height);
  const overlap = intersectionArea(ctx.bbox, heading.rect as DOMRect);
  return overlap / elArea;
}

/**
 * Detect when the user selected a section heading (not a large UI region).
 */
export function detectSectionHeading(
  ctx: FocusExtractionContext,
  structural: ExtractionCandidate[],
  ranked: ExtractionCandidate[]
): SectionHeadingSignals {
  const sizeClass = classifySelectionSize(ctx.selectionArea);
  if (sizeClass === "large" && ctx.selectionArea > 90_000) {
    return { isSectionHeading: false };
  }

  const headings = structural.filter(
    (c) =>
      (c.type === "heading" || c.metadata?.uiRole === "heading") &&
      c.text &&
      c.text.length <= 120
  );

  if (!headings.length) {
    const expanded = ranked.filter(
      (c) =>
        c.reasonCodes.includes("phrase-expanded") &&
        c.metadata?.uiRole === "heading" &&
        c.text
    );
    headings.push(...expanded);
  }

  if (!headings.length) return { isSectionHeading: false };

  headings.sort((a, b) => {
    const oa = headingOverlap(a, ctx);
    const ob = headingOverlap(b, ctx);
    if (Math.abs(oa - ob) > 0.05) return ob - oa;
    return b.score - a.score;
  });

  const best = headings[0]!;
  const overlap = headingOverlap(best, ctx);
  if (overlap < 0.35) return { isSectionHeading: false };

  const controlCount = structural.filter(
    (c) =>
      c !== best &&
      (c.type === "button" ||
        c.type === "link" ||
        c.type === "tab" ||
        c.metadata?.uiRole === "button" ||
        c.metadata?.uiRole === "link" ||
        c.metadata?.uiRole === "tab")
  ).length;

  if (controlCount >= 4) return { isSectionHeading: false };

  const multiHeading = headings.filter((h) => headingOverlap(h, ctx) >= 0.3).length;
  if (multiHeading >= 3) return { isSectionHeading: false };

  return { isSectionHeading: true, headingCandidate: best };
}
