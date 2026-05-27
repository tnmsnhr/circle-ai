import type { FocusExtractionContext } from "../focus/types.js";
import type { ExtractionCandidate as InternalCandidate } from "../focus/types.js";
import {
  findCodeContainer,
  extractSelectedCodeText,
  countTokensInContainer,
  buildCodeBlockCandidate,
  sampleLooksCodeLike,
} from "./codeBlockExtract.js";

const MIN_CODE_LINES = 4;
const MIN_CODE_TOKENS = 20;
const MIN_SELECTION_LINES = 4;
const MIN_CONTAINER_COVERAGE = 0.28;

export interface LargeCodeBlockSignals {
  isLargeCodeBlock: boolean;
  container: HTMLElement | null;
  codeText: string;
  lineCount: number;
  tokenCount: number;
  overlapRatio: number;
  codeBlockCandidate?: InternalCandidate;
}

export function detectLargeCodeBlock(
  ctx: FocusExtractionContext,
  ranked: InternalCandidate[],
  elements: Element[]
): LargeCodeBlockSignals {
  const empty: LargeCodeBlockSignals = {
    isLargeCodeBlock: false,
    container: null,
    codeText: "",
    lineCount: 0,
    tokenCount: 0,
    overlapRatio: 0,
  };

  const match = findCodeContainer(ctx, elements);
  if (!match) return empty;

  const { element: container, overlapRatio, isMonospace } = match;
  if (!isMonospace && !container.tagName.match(/^(PRE|CODE)$/i)) {
    return empty;
  }

  const { text: codeText, lineCount } = extractSelectedCodeText(container, ctx);
  if (!codeText || lineCount < MIN_SELECTION_LINES) return empty;

  const tokenCount = Math.max(
    countTokensInContainer(ranked, container, ctx.bbox),
    codeText.split(/\s+/).filter(Boolean).length
  );

  const hasEnoughTokens = tokenCount >= MIN_CODE_TOKENS;
  const hasEnoughLines = lineCount >= MIN_CODE_LINES;
  const coversContainer =
    overlapRatio >= MIN_CONTAINER_COVERAGE || ctx.selectionArea >= 45_000;
  const codeLike = sampleLooksCodeLike(codeText);

  if (!codeLike && !(isMonospace && hasEnoughLines && hasEnoughTokens)) {
    return empty;
  }

  if (!(hasEnoughLines && (hasEnoughTokens || coversContainer))) {
    return empty;
  }

  const codeBlockCandidate = buildCodeBlockCandidate(container, codeText, ctx);

  return {
    isLargeCodeBlock: true,
    container,
    codeText,
    lineCount,
    tokenCount,
    overlapRatio,
    codeBlockCandidate,
  };
}
