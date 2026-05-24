import type { ExtractedContext } from "../types.js";
import type { ExtractionCandidate as InternalCandidate } from "../focus/types.js";
import type { FocusExtractionContext } from "../focus/types.js";
import type { SelectionCandidate, SelectionEvidence } from "./types.js";
import { mapSignals } from "./signals.js";
import { buildLineFragmentCandidates } from "./lineFragments.js";
import { isWeakToken, isBrokenFragment } from "../focus/quality.js";

let candidateId = 0;

function nextId(): string {
  candidateId += 1;
  return `cand_${candidateId}`;
}

function mapType(type: InternalCandidate["type"]): SelectionCandidate["type"] {
  if (type === "text-range") return "text-fragment";
  return type;
}

function scoreToVisualWeight(score: number, min: number, max: number): number {
  if (max <= min) return Math.max(0, Math.min(1, score / 100));
  return Math.max(0, Math.min(1, (score - min) / (max - min)));
}

function toPublicCandidate(
  c: InternalCandidate,
  minScore: number,
  maxScore: number
): SelectionCandidate {
  const el = c.element;
  const meta: SelectionCandidate["metadata"] = {};
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

  return {
    id: nextId(),
    type: mapType(c.type),
    text: c.text,
    visualWeight: scoreToVisualWeight(c.score, minScore, maxScore),
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
  hasCrop: boolean
): number {
  if (!publicCandidates.length) return 0.1;

  const sorted = [...publicCandidates].sort((a, b) => b.visualWeight - a.visualWeight);
  const top = sorted[0]!;
  const second = sorted[1];

  let c = 0.45 + top.visualWeight * 0.35;
  if (second) {
    const gap = top.visualWeight - second.visualWeight;
    if (gap >= 0.25) c += 0.15;
    else if (gap < 0.08) c -= 0.12;
  }

  if (top.signals.includes("weak-token") && top.visualWeight < 0.55) c -= 0.2;
  if (top.signals.includes("broken-fragment")) c -= 0.25;
  if (top.signals.includes("bbox-only-fallback") && hasPolygon) c -= 0.15;
  if (!hasPolygon) c -= 0.08;
  if (hasCrop && top.type === "media") c += 0.1;
  if (publicCandidates.filter((x) => x.visualWeight >= 0.5).length >= 3) {
    c -= 0.08;
  }

  return Math.max(0.05, Math.min(1, c));
}

function capCandidates(
  publicCandidates: SelectionCandidate[],
  multiLine: boolean
): SelectionCandidate[] {
  const max = multiLine ? 8 : 5;
  const sorted = [...publicCandidates].sort((a, b) => b.visualWeight - a.visualWeight);

  const picked = new Map<string, SelectionCandidate>();

  const add = (c: SelectionCandidate | undefined) => {
    if (!c || picked.has(c.id)) return;
    picked.set(c.id, c);
  };

  add(sorted[0]);
  add(sorted.find((c) => c.type === "media"));
  add(sorted.find((c) => c.type === "structured"));
  add(
    sorted.find((c) =>
      c.signals.includes("multi-line-fragment") || c.signals.includes("combined-selection")
    )
  );

  for (const c of sorted) {
    if (picked.size >= max) break;
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

  const lineFrags = buildLineFragmentCandidates(input.ranked, input.ctx);
  const merged = [...input.ranked, ...lineFrags];

  const valid = merged.filter((c) => c.score > -500 && (c.text?.trim() || c.type === "media"));
  const scores = valid.map((c) => c.score);
  const minScore = scores.length ? Math.min(...scores) : 0;
  const maxScore = scores.length ? Math.max(...scores) : 1;

  let publicCandidates = valid.map((c) => toPublicCandidate(c, minScore, maxScore));

  const lineKeys = new Set(
    valid
      .filter((c) => c.type === "text-token" || c.type === "text-range")
      .map((c) => Math.round(c.rect.top + c.rect.height / 2))
  );
  const multiLine = lineKeys.size >= 2;

  publicCandidates = capCandidates(publicCandidates, multiLine);

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
    hasCrop
  );

  const top = publicCandidates[0];
  const extractedText = top?.text?.trim() || undefined;

  return {
    candidates: publicCandidates,
    extractedText,
    cropImageBase64: input.cropImageBase64,
    hasVisual,
    evidenceConfidence,
  };
}

/** Text for shape classification — prefer combined multi-line or strongest non-weak fragment. */
export function textForShapeClassification(evidence: SelectionEvidence): string {
  const combined = evidence.candidates.find((c) =>
    c.signals.includes("combined-selection")
  );
  if (combined?.text) return combined.text;

  const frag = evidence.candidates.find(
    (c) => c.type === "text-fragment" && c.text && !isWeakToken(c.text)
  );
  if (frag?.text) return frag.text;

  const token = evidence.candidates.find(
    (c) => c.type === "text-token" && c.text && !isWeakToken(c.text)
  );
  if (token?.text) return token.text;

  return evidence.extractedText?.trim() ?? "";
}

export function hasWeakOnlyEvidence(evidence: SelectionEvidence): boolean {
  const substantive = evidence.candidates.filter(
    (c) => c.text && !isWeakToken(c.text) && !isBrokenFragment(c.text)
  );
  return substantive.length === 0;
}
