import type { FocusExtractionContext } from "../focus/types.js";
import type { ExtractionCandidate as InternalCandidate } from "../focus/types.js";
import { classifyUiRole, type CandidateUiRole } from "./uiRole.js";
import { classifySelectionSize } from "./selectionSize.js";
import { rejectNoisyMergedCandidate } from "./candidateTextCleanup.js";
import { findCodeContainer } from "./codeBlockExtract.js";

const INTERACTIVE_TAGS = new Set([
  "BUTTON",
  "A",
  "INPUT",
  "SELECT",
  "TEXTAREA",
  "SUMMARY",
]);

function countDistinctUiRoles(elements: Element[]): Set<CandidateUiRole> {
  const roles = new Set<CandidateUiRole>();
  for (const el of elements) {
    const role = classifyUiRole(el);
    if (role !== "unknown") roles.add(role);
  }
  return roles;
}

function countControlElements(elements: Element[]): number {
  let n = 0;
  const seen = new Set<Element>();
  for (const el of elements) {
    let cur: Element | null = el;
    for (let d = 0; cur && d < 6; d++) {
      if (seen.has(cur)) break;
      seen.add(cur);
      const tag = cur.tagName;
      const role = (cur.getAttribute("role") || "").toLowerCase();
      if (
        INTERACTIVE_TAGS.has(tag) ||
        role === "button" ||
        role === "tab" ||
        role === "link" ||
        /^H[1-6]$/.test(tag)
      ) {
        n++;
        break;
      }
      cur = cur.parentElement;
    }
  }
  return n;
}

function lineCountFromCandidates(candidates: InternalCandidate[]): number {
  const tops = new Set(
    candidates
      .filter((c) => c.text && (c.type === "text-token" || c.type === "text-range"))
      .map((c) => Math.round((c.rect.top + c.rect.height / 2) / 10))
  );
  return tops.size;
}

export interface StructuredRegionSignals {
  isStructuredRegion: boolean;
  roleCount: number;
  controlCount: number;
  lineCount: number;
  selectionSize: ReturnType<typeof classifySelectionSize>;
}

export function detectStructuredRegion(
  ctx: FocusExtractionContext,
  elements: Element[],
  ranked: InternalCandidate[]
): StructuredRegionSignals {
  const codeMatch = findCodeContainer(ctx, elements);
  if (codeMatch && (codeMatch.isMonospace || codeMatch.overlapRatio >= 0.2)) {
    return {
      isStructuredRegion: false,
      roleCount: 0,
      controlCount: 0,
      lineCount: 0,
      selectionSize: classifySelectionSize(ctx),
    };
  }

  const selectionSize = classifySelectionSize(ctx);
  const roles = countDistinctUiRoles(elements);
  const controlCount = countControlElements(elements);
  const lineCount = lineCountFromCandidates(ranked);

  const hasHeading = roles.has("heading");
  const hasActions =
    roles.has("button") || roles.has("link") || roles.has("tab");
  const hasMetadata = roles.has("metadata") || roles.has("status");

  const largeArea =
    selectionSize === "large" ||
    (selectionSize === "medium" && ctx.selectionArea > 55_000);

  const multiRole =
    roles.size >= 3 ||
    (hasHeading && hasActions) ||
    (hasActions && hasMetadata && controlCount >= 2);

  const multiControl = controlCount >= 3;
  const multiLine = lineCount >= 2;

  const noisyMega = ranked.some(
    (c) =>
      c.text &&
      c.reasonCodes.includes("combined-selection") &&
      rejectNoisyMergedCandidate(c.text)
  );

  const isStructuredRegion =
    largeArea &&
    (multiRole || multiControl || (multiLine && controlCount >= 2)) &&
    !noisyMega;

  return {
    isStructuredRegion,
    roleCount: roles.size,
    controlCount,
    lineCount,
    selectionSize,
  };
}
