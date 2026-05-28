import type { ExtractedContext } from "./types.js";

export type SelectionShape = "visual_selection";

export interface ContextLens {
  pageTitle?: string;
  pageType?: string;
  domain?: string;
  nearestHeading?: string;
  topicHint?: string;
}

const AUTO_EXPLAIN_MARKERS: Array<string | RegExp> = [
  "__syncle_explain_selection__",
  /^Summarize what the user selected/i,
  /^Explain the selected content/i,
];

export function normalizeSelectionShape(value: unknown): SelectionShape | undefined {
  if (value === "visual_selection") return "visual_selection";
  return undefined;
}

export function isAutoExplainMessage(message: string): boolean {
  const m = message.trim();
  return AUTO_EXPLAIN_MARKERS.some((marker) =>
    typeof marker === "string" ? m === marker : marker.test(m)
  );
}

export function defaultUserMessageForShape(): string {
  return "Describe and explain what is shown in the selected visual region.";
}

function truncate(s: string, max: number): string {
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

export function buildContextLens(
  extracted: ExtractedContext
): ContextLens | undefined {
  const { context, source } = extracted;
  const lens: ContextLens = {};

  if (context.pageTitle) lens.pageTitle = truncate(context.pageTitle, 200);
  if (source.domain) lens.domain = source.domain;
  if (source.type) lens.pageType = source.type;
  if (context.h1?.trim()) lens.nearestHeading = truncate(context.h1, 120);
  if (context.metaDescription?.trim()) {
    lens.topicHint = truncate(context.metaDescription, 160);
  }

  return Object.keys(lens).length > 0 ? lens : undefined;
}

export function classifySelectionShape(): SelectionShape {
  return "visual_selection";
}
