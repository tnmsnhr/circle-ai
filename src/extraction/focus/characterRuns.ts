import type { FocusExtractionContext } from "./types.js";
import type { ExtractionCandidate } from "./types.js";
import { charHitsSelection } from "./textGeometry.js";
import { collectTextNodesInSelection } from "./textNodes.js";
import { scoreTextRangeCandidate, attachConfidence } from "./scoreCandidate.js";
import { isWeakToken } from "./quality.js";
import { sameVisualLine } from "./geometry.js";

interface CharRun {
  node: Text;
  start: number;
  end: number;
  rect: DOMRect;
}

function measureCharRect(node: Text, index: number): DOMRect | null {
  const len = node.textContent?.length ?? 0;
  if (index < 0 || index >= len) return null;
  const range = document.createRange();
  try {
    range.setStart(node, index);
    range.setEnd(node, index + 1);
  } catch {
    return null;
  }
  const rects = range.getClientRects();
  if (rects.length) return rects[0];
  const b = range.getBoundingClientRect();
  return b.width > 0 || b.height > 0 ? b : null;
}

function runsInTextNode(
  node: Text,
  ctx: FocusExtractionContext
): CharRun[] {
  const text = node.textContent ?? "";
  const runs: CharRun[] = [];
  let runStart = -1;
  let runEnd = -1;
  let runRect: DOMRect | null = null;

  const flush = () => {
    if (runStart < 0 || runEnd <= runStart || !runRect) return;
    runs.push({ node, start: runStart, end: runEnd, rect: runRect });
    runStart = -1;
    runEnd = -1;
    runRect = null;
  };

  const maxChars = 2000;
  const limit = Math.min(text.length, maxChars);
  for (let i = 0; i < limit; i++) {
    if (/\s/.test(text[i]!)) {
      flush();
      continue;
    }
    const rect = measureCharRect(node, i);
    if (!rect || !charHitsSelection(rect, ctx.polygon, ctx.bbox, 0.12)) {
      flush();
      continue;
    }
    if (runStart < 0) {
      runStart = i;
      runEnd = i + 1;
      runRect = rect;
    } else {
      runEnd = i + 1;
      runRect = unionRect(runRect, rect);
    }
  }
  flush();
  return runs;
}

function unionRect(a: DOMRect, b: DOMRect): DOMRect {
  const left = Math.min(a.left, b.left);
  const top = Math.min(a.top, b.top);
  const right = Math.max(a.right, b.right);
  const bottom = Math.max(a.bottom, b.bottom);
  return new DOMRect(left, top, right - left, bottom - top);
}

function runToText(run: CharRun): string {
  return (run.node.textContent ?? "").slice(run.start, run.end).trim();
}

function mergeRunsOnLine(runs: CharRun[]): CharRun[] {
  if (runs.length <= 1) return runs;
  runs.sort((a, b) => a.rect.left - b.rect.left);
  const merged: CharRun[] = [];
  for (const run of runs) {
    const prev = merged[merged.length - 1];
    if (
      prev &&
      prev.node === run.node &&
      sameVisualLine(
        {
          left: prev.rect.left,
          top: prev.rect.top,
          right: prev.rect.right,
          bottom: prev.rect.bottom,
          width: prev.rect.width,
          height: prev.rect.height,
        },
        {
          left: run.rect.left,
          top: run.rect.top,
          right: run.rect.right,
          bottom: run.rect.bottom,
          width: run.rect.width,
          height: run.rect.height,
        }
      ) &&
      run.rect.left - prev.rect.right <= 14
    ) {
      prev.end = run.end;
      prev.node = run.node;
      prev.rect = unionRect(prev.rect, run.rect);
    } else {
      merged.push({ ...run });
    }
  }
  return merged;
}

/** Character-granularity text inside polygon/bbox. */
export function collectCharacterRunCandidates(
  ctx: FocusExtractionContext
): ExtractionCandidate[] {
  const out: ExtractionCandidate[] = [];
  const nodes = collectTextNodesInSelection(ctx.bbox, ctx.elements).slice(0, 48);
  const allRuns: CharRun[] = [];

  for (const node of nodes) {
    const text = node.textContent ?? "";
    if (text.length > 4000) continue;
    allRuns.push(...runsInTextNode(node, ctx));
  }

  const merged = mergeRunsOnLine(allRuns);

  for (const run of merged) {
    const text = runToText(run);
    if (!text || text.length < 1) continue;
    if (isWeakToken(text) && ctx.selectionArea < 8000) continue;

    const { score, reasonCodes } = scoreTextRangeCandidate(
      text,
      run.rect,
      ctx,
      "char-run"
    );
    if (score < 6) continue;

    out.push(
      attachConfidence({
        type: "text-range",
        text,
        rect: {
          left: run.rect.left,
          top: run.rect.top,
          right: run.rect.right,
          bottom: run.rect.bottom,
          width: run.rect.width,
          height: run.rect.height,
        },
        element: run.node.parentElement ?? undefined,
        score,
        confidence: 0,
        reasonCodes,
      })
    );
  }

  return out;
}
