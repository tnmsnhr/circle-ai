import type { ExtractedContext } from "../types.js";
import { isVisible } from "../dom/visibility.js";

function nearestSectionHeading(container: Element): string | undefined {
  let cur: Element | null = container;
  const seen = new Set<string>();

  while (cur && cur !== document.body) {
    const parent = cur.parentElement;
    if (!parent) break;

    const siblings = parent.querySelectorAll("h1,h2,h3,h4,h5,h6");
    for (const h of siblings) {
      if (!isVisible(h)) continue;
      const box = h.getBoundingClientRect();
      const cbox = container.getBoundingClientRect();
      if (box.bottom > cbox.top + 8) continue;
      const t = h.textContent?.trim();
      if (t && t.length <= 160 && !seen.has(t)) {
        seen.add(t);
        return t;
      }
    }
    cur = parent;
  }

  return undefined;
}

function oneLineBefore(container: Element): string | undefined {
  const cbox = container.getBoundingClientRect();
  const candidates: Array<{ dist: number; text: string }> = [];

  document.querySelectorAll("p,h2,h3,h4,h5,h6,figcaption").forEach((el) => {
    if (!isVisible(el)) return;
    const box = el.getBoundingClientRect();
    if (box.bottom > cbox.top) return;
    const dist = cbox.top - box.bottom;
    if (dist > 120) return;
    const t = el.textContent?.trim();
    if (t && t.length >= 8 && t.length <= 200) {
      candidates.push({ dist, text: t });
    }
  });

  candidates.sort((a, b) => a.dist - b.dist);
  return candidates[0]?.text;
}

/** Compact context for large code-block selections. */
export function buildCodeBlockLocalContext(
  extracted: ExtractedContext,
  container: HTMLElement | null,
  maxLen = 900
): string {
  const parts: string[] = [];

  if (extracted.context.pageTitle?.trim()) {
    parts.push(`[Page] ${extracted.context.pageTitle.trim().slice(0, 120)}`);
  }

  const section =
    (container && nearestSectionHeading(container)) ||
    extracted.context.headings.find((h) => h.trim());
  if (section) parts.push(`[Section] ${section.slice(0, 120)}`);

  const nearby =
    (container && oneLineBefore(container)) ||
    extracted.context.headings[1]?.trim();
  if (nearby) parts.push(`[Nearby] ${nearby.slice(0, 200)}`);

  const block = parts.join("\n");
  return block.length <= maxLen ? block : `${block.slice(0, maxLen)}…`;
}
