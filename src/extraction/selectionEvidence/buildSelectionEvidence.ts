import type { ExtractedContext } from "../types.js";
import type { ExtractionCandidate as InternalCandidate } from "../focus/types.js";
import type { FocusExtractionContext } from "../focus/types.js";
import type { SelectionCandidate, SelectionEvidence } from "./types.js";
import type { CandidateUiRole } from "./types.js";
import { mapSignals } from "./signals.js";
import { buildLineFragmentCandidates } from "./lineFragments.js";
import { isWeakToken, isBrokenFragment } from "../focus/quality.js";
import {
  normalizeCandidateText,
  rejectNoisyMergedCandidate,
} from "./candidateTextCleanup.js";
import { detectStructuredRegion } from "./regionDetection.js";
import { buildGroupedUiCandidates } from "./groupUiCandidates.js";
import { classifySelectionSize } from "./selectionSize.js";
import { detectLargeCodeBlock } from "./codeBlockDetection.js";
import { preserveCodeText } from "./codeBlockExtract.js";
import { collectDomStructuralCandidates } from "./domStructuralCandidates.js";
import { expandPhrasesFromCandidates } from "./phraseExpansion.js";
import { detectSectionHeading } from "./sectionHeadingDetection.js";
import { dedupeCandidates } from "./candidateDedup.js";

let candidateId = 0;

function nextId(): string {
  candidateId += 1;
  return `cand_${candidateId}`;
}

function mapType(type: InternalCandidate["type"]): SelectionCandidate["type"] {
  if (type === "text-range" || type === "text-fragment") return "text-fragment";
  if (type === "region") return "region";
  if (type === "code-block") return "code-block";
  if (type === "heading") return "heading";
  if (type === "button") return "button";
  if (type === "link") return "link";
  if (type === "tab") return "tab";
  return type as SelectionCandidate["type"];
}

function scoreToVisualWeight(
  score: number,
  min: number,
  max: number,
  structuredRegion: boolean
): number {
  if (structuredRegion && score >= 70) {
    return Math.max(0.55, Math.min(0.92, score / 85));
  }
  if (max <= min) return Math.max(0, Math.min(1, score / 100));
  return Math.max(0, Math.min(1, (score - min) / (max - min)));
}

function toPublicCandidate(
  c: InternalCandidate,
  minScore: number,
  maxScore: number,
  structuredRegion: boolean,
  largeCodeBlock: boolean,
  sectionHeading: boolean,
  hasStructuralPriority: boolean
): SelectionCandidate | null {
  const text =
    c.type === "code-block" && c.text
      ? preserveCodeText(c.text)
      : c.text
        ? normalizeCandidateText(c.text)
        : undefined;
  if (text && c.type !== "code-block" && rejectNoisyMergedCandidate(text)) {
    return null;
  }

  const el = c.element;
  const meta: SelectionCandidate["metadata"] = {};
  const uiRole = (c.metadata?.uiRole as CandidateUiRole | undefined) ?? undefined;

  if (el) {
    meta.tagName = el.tagName?.toLowerCase();
    meta.role = el.getAttribute?.("role") ?? undefined;
    if (c.type === "media") {
      meta.alt = el.getAttribute?.("alt") ?? undefined;
      meta.title = el.getAttribute?.("title") ?? undefined;
      if (c.metadata?.isPartialSelection === true) {
        meta.isPartialMedia = true;
      }
    }
  }
  if (c.metadata?.isPartialSelection === true) {
    meta.isPartialMedia = true;
  }
  if (c.metadata?.regionType) {
    meta.regionType = String(c.metadata.regionType);
  }
  if (uiRole) meta.uiRole = uiRole;

  let visualWeight = scoreToVisualWeight(
    c.score,
    minScore,
    maxScore,
    structuredRegion
  );

  if (largeCodeBlock && c.type === "code-block") {
    visualWeight = 0.96;
  } else if (largeCodeBlock && c.type === "text-token") {
    visualWeight *= 0.25;
  } else if (largeCodeBlock) {
    visualWeight *= 0.35;
  }

  if (sectionHeading && (c.type === "heading" || uiRole === "heading")) {
    visualWeight = Math.max(visualWeight, 0.94);
  } else if (c.type === "heading" || uiRole === "heading") {
    visualWeight = Math.max(visualWeight, 0.88);
  } else if (
    c.type === "button" ||
    c.type === "link" ||
    c.type === "tab" ||
    uiRole === "button" ||
    uiRole === "link" ||
    uiRole === "tab"
  ) {
    visualWeight = Math.max(visualWeight, 0.82);
  }

  if (c.reasonCodes.includes("phrase-expanded")) {
    visualWeight = Math.max(visualWeight, sectionHeading ? 0.9 : 0.85);
  }

  if (hasStructuralPriority && c.type === "text-token") {
    visualWeight *= 0.35;
  } else if (hasStructuralPriority && c.type === "text-range") {
    visualWeight *= 0.55;
  }

  if (structuredRegion) {
    if (c.type === "region") visualWeight = Math.max(visualWeight, 0.78);
    if (c.reasonCodes.includes("combined-selection")) visualWeight *= 0.35;
    if (c.reasonCodes.includes("center-line")) visualWeight *= 0.5;
    if (c.reasonCodes.includes("line-fragment") && !uiRole) visualWeight *= 0.65;
    if (uiRole === "heading") visualWeight = Math.max(visualWeight, 0.62);
    if (uiRole === "button" || uiRole === "link" || uiRole === "tab") {
      visualWeight = Math.max(visualWeight, 0.55);
    }
  }

  return {
    id: nextId(),
    type: mapType(c.type),
    text,
    uiRole: c.type === "region" ? "region" : uiRole,
    visualWeight,
    confidence: c.confidence ?? Math.max(0.05, Math.min(1, c.score / 95)),
    signals: mapSignals(c.reasonCodes),
    rect: {
      left: c.rect.left,
      top: c.rect.top,
      width: c.rect.width,
      height: c.rect.height,
    },
    metadata: Object.keys(meta).length ? meta : undefined,
  };
}

function computeEvidenceConfidence(
  publicCandidates: SelectionCandidate[],
  hasPolygon: boolean,
  hasCrop: boolean,
  structuredRegion: boolean,
  largeCodeBlock: boolean,
  sectionHeading: boolean
): number {
  if (!publicCandidates.length) return 0.1;

  const sorted = [...publicCandidates].sort((a, b) => b.visualWeight - a.visualWeight);
  const codeBlock = sorted.find((c) => c.type === "code-block");
  const region = sorted.find((c) => c.type === "region");
  const heading = sorted.find((c) => c.type === "heading" || c.uiRole === "heading");
  const top = codeBlock ?? region ?? heading ?? sorted[0]!;

  if (largeCodeBlock && codeBlock) {
    let c = 0.82;
    if (codeBlock.text && codeBlock.text.length > 80) c += 0.08;
    if (hasPolygon) c += 0.04;
    if (!hasCrop) c += 0.04;
    return Math.min(0.98, c);
  }

  if (sectionHeading && heading) {
    let c = 0.78;
    if (heading.text && heading.text.length >= 8) c += 0.06;
    if (heading.signals.includes("phrase-expanded")) c += 0.04;
    if (hasPolygon) c += 0.04;
    if (!hasCrop) c += 0.04;
    return Math.min(0.96, c);
  }

  const substantive = sorted.filter(
    (c) => c.text && !isWeakToken(c.text) && !isBrokenFragment(c.text)
  );

  let c = structuredRegion ? 0.52 : 0.45;
  c += top.visualWeight * 0.28;

  if (structuredRegion && region) c += 0.12;
  if (substantive.length >= 3) c += 0.08;
  if (substantive.length >= 5) c += 0.05;

  const noisyTop =
    top.text &&
    (rejectNoisyMergedCandidate(top.text) || isBrokenFragment(top.text));
  if (noisyTop) c -= 0.22;

  if (top.signals.includes("weak-token") && top.visualWeight < 0.55) c -= 0.2;
  if (top.signals.includes("broken-fragment")) c -= 0.25;
  if (!hasPolygon) c -= 0.06;
  if (hasCrop) c += 0.08;

  if (structuredRegion) {
    const roles = new Set(substantive.map((x) => x.uiRole).filter(Boolean));
    if (roles.size >= 3) c += 0.1;
    if (!region && substantive.length < 2) c -= 0.15;
  } else {
    const second = sorted[1];
    if (second) {
      const gap = top.visualWeight - second.visualWeight;
      if (gap >= 0.25) c += 0.12;
      else if (gap < 0.08) c -= 0.1;
    }
  }

  return Math.max(0.05, Math.min(1, c));
}

function capCandidates(
  publicCandidates: SelectionCandidate[],
  structuredRegion: boolean,
  largeCodeBlock: boolean,
  sectionHeading: boolean,
  multiLine: boolean
): SelectionCandidate[] {
  if (largeCodeBlock) {
    const code = publicCandidates.find((c) => c.type === "code-block");
    return code ? [code] : publicCandidates.slice(0, 1);
  }

  const max = structuredRegion ? 8 : multiLine ? 8 : 6;
  const sorted = [...publicCandidates].sort((a, b) => b.visualWeight - a.visualWeight);
  const picked = new Map<string, SelectionCandidate>();

  const add = (c: SelectionCandidate | undefined | null) => {
    if (!c || picked.has(c.id)) return;
    picked.set(c.id, c);
  };

  add(sorted.find((c) => c.type === "region"));
  add(sorted.find((c) => c.type === "code-block"));
  add(sorted.find((c) => c.type === "heading" || c.uiRole === "heading"));
  add(sorted.find((c) => c.type === "button" || c.uiRole === "button"));
  add(sorted.find((c) => c.type === "link" || c.uiRole === "link"));
  add(sorted.find((c) => c.type === "tab" || c.uiRole === "tab"));
  add(sorted.find((c) => c.signals.includes("phrase-expanded")));
  add(sorted[0]);

  if (structuredRegion) {
    for (const role of [
      "heading",
      "button",
      "link",
      "tab",
      "metadata",
      "status",
    ] as CandidateUiRole[]) {
      add(sorted.find((c) => c.uiRole === role));
    }
  }

  add(sorted.find((c) => c.type === "media"));
  add(sorted.find((c) => c.type === "structured"));

  if (!structuredRegion) {
    add(
      sorted.find((c) =>
        c.signals.includes("multi-line-fragment") ||
        c.signals.includes("combined-selection")
      )
    );
  }

  for (const c of sorted) {
    if (picked.size >= max) break;
    if (c.signals.includes("combined-selection") && structuredRegion) continue;
    if (sectionHeading && c.type === "text-token" && c.visualWeight < 0.4) continue;
    add(c);
  }

  return [...picked.values()].sort((a, b) => b.visualWeight - a.visualWeight);
}

export interface BuildEvidenceInput {
  ranked: InternalCandidate[];
  ctx: FocusExtractionContext;
  extracted: ExtractedContext;
  cropImageBase64?: string;
}

export function buildSelectionEvidence(input: BuildEvidenceInput): SelectionEvidence {
  candidateId = 0;

  const codeSignals = detectLargeCodeBlock(
    input.ctx,
    input.ranked,
    input.ctx.elements
  );
  const largeCodeBlock = codeSignals.isLargeCodeBlock;

  const regionSignals = detectStructuredRegion(
    input.ctx,
    input.ctx.elements,
    input.ranked
  );
  const structuredRegion = !largeCodeBlock && regionSignals.isStructuredRegion;
  const sizeClass = regionSignals.selectionSize;

  const structural = collectDomStructuralCandidates(
    input.ctx,
    input.ctx.elements
  );
  const phraseExpanded = expandPhrasesFromCandidates(input.ranked, input.ctx);
  const sectionHeadingSignals = detectSectionHeading(
    input.ctx,
    [...structural, ...phraseExpanded],
    input.ranked
  );
  const sectionHeading =
    !largeCodeBlock &&
    !structuredRegion &&
    sectionHeadingSignals.isSectionHeading;

  let merged: InternalCandidate[] = [];
  const hasStructuralPriority =
    structural.length > 0 || phraseExpanded.length > 0 || sectionHeading;

  if (largeCodeBlock && codeSignals.codeBlockCandidate) {
    merged.push(codeSignals.codeBlockCandidate);
    const mediaOnly = input.ranked.filter(
      (c) => c.type === "media" && c.score > 0
    );
    merged.push(...mediaOnly);
  } else if (sectionHeading && sectionHeadingSignals.headingCandidate) {
    const heading = {
      ...sectionHeadingSignals.headingCandidate,
      score: Math.max(118, sectionHeadingSignals.headingCandidate.score),
      reasonCodes: [
        ...sectionHeadingSignals.headingCandidate.reasonCodes,
        "section-title",
        "inside-selection",
      ],
    };
    merged.push(heading);

    const mediaOnly = input.ranked.filter(
      (c) => c.type === "media" && c.score > 0
    );
    merged.push(...mediaOnly);

    for (const s of structural.slice(0, 2)) {
      if (s.text !== heading.text) {
        merged.push({ ...s, score: s.score * 0.55 });
      }
    }

    for (const t of input.ranked
      .filter((c) => c.type === "text-token")
      .slice(0, 2)) {
      merged.push({ ...t, score: t.score * 0.28 });
    }
  } else if (structuredRegion) {
    const grouped = buildGroupedUiCandidates(
      input.ctx,
      input.ctx.elements,
      input.ranked
    );
    if (grouped.regionCandidate) merged.push(grouped.regionCandidate);
    merged.push(...grouped.grouped);

    const mediaStructured = input.ranked.filter(
      (c) =>
        (c.type === "media" || c.type === "structured") &&
        c.score > 0 &&
        (!c.text || !rejectNoisyMergedCandidate(c.text))
    );
    merged.push(...mediaStructured);
  } else {
    const media = input.ranked.filter((c) => c.type === "media" && c.score > 0);
    merged.push(...media);
    merged.push(...structural);
    merged.push(...phraseExpanded);

    if (sizeClass !== "large") {
      merged.push(...buildLineFragmentCandidates(input.ranked, input.ctx));
    }

    for (const c of input.ranked) {
      if (c.type === "media") continue;
      if (hasStructuralPriority && c.type === "text-token") {
        merged.push({ ...c, score: c.score * 0.38 });
      } else if (hasStructuralPriority && c.type === "text-range") {
        merged.push({ ...c, score: c.score * 0.55 });
      } else {
        merged.push(c);
      }
    }
  }

  const valid = merged.filter((c) => {
    if (c.score <= -500) return false;
    if (c.type === "media") return true;
    if (c.type === "region" || c.type === "code-block") {
      return Boolean(c.text?.trim());
    }
    if (!c.text?.trim()) return false;
    return !rejectNoisyMergedCandidate(c.text);
  });

  const scores = valid.map((c) => c.score);
  const minScore = scores.length ? Math.min(...scores) : 0;
  const maxScore = scores.length ? Math.max(...scores) : 1;

  let publicCandidates = valid
    .map((c) =>
      toPublicCandidate(
        c,
        minScore,
        maxScore,
        structuredRegion,
        largeCodeBlock,
        sectionHeading,
        hasStructuralPriority
      )
    )
    .filter((c): c is SelectionCandidate => c !== null);

  const lineKeys = new Set(
    valid
      .filter((c) => c.type === "text-token" || c.type === "text-range")
      .map((c) => Math.round(c.rect.top + c.rect.height / 2))
  );
  const multiLine = lineKeys.size >= 2;

  publicCandidates = capCandidates(
    publicCandidates,
    structuredRegion,
    largeCodeBlock,
    sectionHeading,
    multiLine
  );

  publicCandidates = dedupeCandidates(publicCandidates);

  const hasCrop = Boolean(input.cropImageBase64);
  const hasVisual =
    hasCrop ||
    publicCandidates.some((c) => c.type === "media") ||
    input.extracted.focus.elementTypes.some((t) =>
      ["image", "canvas", "video", "svg", "pdf"].includes(t)
    );

  const evidenceConfidence = computeEvidenceConfidence(
    publicCandidates,
    input.ctx.hasPolygon,
    hasCrop,
    structuredRegion,
    largeCodeBlock,
    sectionHeading
  );

  const codeBlock = publicCandidates.find((c) => c.type === "code-block");
  const region = publicCandidates.find((c) => c.type === "region");
  const headingCand = publicCandidates.find(
    (c) => c.type === "heading" || c.uiRole === "heading"
  );
  const topNonNoisy = publicCandidates.find(
    (c) => c.text && !isWeakToken(c.text) && !rejectNoisyMergedCandidate(c.text)
  );
  const extractedText = largeCodeBlock
    ? codeBlock?.text ?? topNonNoisy?.text
    : sectionHeading
      ? headingCand?.text ?? topNonNoisy?.text
      : structuredRegion
        ? region?.text ?? topNonNoisy?.text
        : topNonNoisy?.text;

  return {
    candidates: publicCandidates,
    extractedText,
    cropImageBase64: input.cropImageBase64,
    hasVisual,
    evidenceConfidence,
    isStructuredRegion: structuredRegion,
    isLargeCodeBlock: largeCodeBlock,
    isSectionHeading: sectionHeading,
    selectionSubType: largeCodeBlock ? "large_code_block" : undefined,
  };
}

/** Text for shape classification. */
export function textForShapeClassification(evidence: SelectionEvidence): string {
  const codeBlock = evidence.candidates.find((c) => c.type === "code-block");
  if (codeBlock?.text) return codeBlock.text.slice(0, 400);

  const region = evidence.candidates.find((c) => c.type === "region");
  if (region?.text) return region.text;

  const heading = evidence.candidates.find(
    (c) => c.type === "heading" || c.uiRole === "heading"
  );
  if (heading?.text) return heading.text;

  const headings = evidence.candidates
    .filter((c) => c.uiRole === "heading" && c.text)
    .map((c) => c.text!);
  if (headings.length) return headings.join(" · ");

  const combined = evidence.candidates.find((c) =>
    c.signals.includes("combined-selection")
  );
  if (combined?.text && !rejectNoisyMergedCandidate(combined.text)) {
    return combined.text;
  }

  const frag = evidence.candidates.find(
    (c) => c.type === "text-fragment" && c.text && !isWeakToken(c.text)
  );
  if (frag?.text) return frag.text;

  return evidence.extractedText?.trim() ?? "";
}

export function hasWeakOnlyEvidence(evidence: SelectionEvidence): boolean {
  const substantive = evidence.candidates.filter(
    (c) => c.text && !isWeakToken(c.text) && !isBrokenFragment(c.text)
  );
  return substantive.length === 0;
}
