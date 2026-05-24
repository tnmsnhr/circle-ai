import { elementBox } from "../geometry/rect.js";
import { isVisible } from "../dom/visibility.js";
import type { FocusExtractionContext } from "./types.js";
import type { ExtractionCandidate } from "./types.js";
import { scoreStructuredCandidate, attachConfidence } from "./scoreCandidate.js";

const STRUCTURED_TAGS = new Set([
  "TD",
  "TH",
  "LI",
  "DT",
  "DD",
  "BUTTON",
  "LABEL",
  "CAPTION",
  "FIGCAPTION",
]);

export function collectStructuredCandidates(
  ctx: FocusExtractionContext
): ExtractionCandidate[] {
  const out: ExtractionCandidate[] = [];

  for (const el of ctx.elements) {
    if (!STRUCTURED_TAGS.has(el.tagName)) continue;
    if (!isVisible(el)) continue;

    const box = elementBox(el);
    const text =
      el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
        ? el.value
        : (el.textContent ?? "").trim().slice(0, 500);

    if (!text && el.tagName !== "TD" && el.tagName !== "TH") continue;

    const { score, reasonCodes } = scoreStructuredCandidate(text, box, ctx);
    if (score < 0) continue;

    out.push(
      attachConfidence({
        type: "structured",
        text: text || undefined,
        rect: {
          left: box.left,
          top: box.top,
          right: box.right,
          bottom: box.bottom,
          width: box.width,
          height: box.height,
        },
        element: el,
        metadata: { tag: el.tagName.toLowerCase() },
        score,
        confidence: 0,
        reasonCodes,
      })
    );
  }

  return out;
}
