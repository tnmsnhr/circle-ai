import { elementBox, intersectionArea } from "../geometry/rect.js";
import { isVisible } from "../dom/visibility.js";
import type { FocusExtractionContext } from "./types.js";
import type { ExtractionCandidate } from "./types.js";
import { scoreMediaCandidate, attachConfidence } from "./scoreCandidate.js";

const MEDIA_TAGS = new Set([
  "IMG",
  "PICTURE",
  "VIDEO",
  "CANVAS",
  "SVG",
  "OBJECT",
  "EMBED",
  "IFRAME",
]);

export function collectMediaCandidates(
  ctx: FocusExtractionContext
): ExtractionCandidate[] {
  const out: ExtractionCandidate[] = [];

  for (const el of ctx.elements) {
    if (!MEDIA_TAGS.has(el.tagName) && el.tagName !== "FIGURE") continue;
    if (!isVisible(el)) continue;

    const box = elementBox(el);
    const elArea = Math.max(1, box.width * box.height);
    const overlap = intersectionArea(ctx.bbox, box);
    const partial = overlap > 0 && overlap / elArea < 0.85;

    const { score, reasonCodes } = scoreMediaCandidate(box, el, ctx, partial);
    if (score < 0) continue;

    const alt =
      el instanceof HTMLImageElement
        ? el.alt
        : el.getAttribute("aria-label") || el.getAttribute("title") || "";

    out.push(
      attachConfidence({
        type: "media",
        text: alt.trim() || undefined,
        rect: {
          left: box.left,
          top: box.top,
          right: box.right,
          bottom: box.bottom,
          width: box.width,
          height: box.height,
        },
        element: el,
        metadata: {
          mediaType: el.tagName.toLowerCase(),
          isPartialSelection: partial,
          alt: alt || undefined,
        },
        score,
        confidence: 0,
        reasonCodes,
      })
    );
  }

  return out;
}
