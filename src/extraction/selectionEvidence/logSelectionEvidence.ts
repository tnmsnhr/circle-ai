import type { SelectionEvidence } from "./types.js";
import type { SelectionShape } from "../selectionShape.js";

export function logSelectionEvidence(
  evidence: SelectionEvidence,
  opts: {
    selectionShape: SelectionShape;
    localContextLen: number;
    payloadJsonBytes: number;
    selectionId?: string;
  }
): void {
  const label = opts.selectionId
    ? `[syncle] selection evidence · ${opts.selectionId.slice(0, 8)}`
    : "[syncle] selection evidence";

  console.info(label, {
    selectionShape: opts.selectionShape,
    evidenceConfidence: evidence.evidenceConfidence,
    candidateCount: evidence.candidates.length,
    topCandidates: evidence.candidates.slice(0, 5).map((c) => ({
      type: c.type,
      text: c.text?.slice(0, 80),
      visualWeight: Math.round(c.visualWeight * 100) / 100,
      signals: c.signals.slice(0, 6),
    })),
    hasCrop: Boolean(evidence.cropImageBase64),
    cropChars: evidence.cropImageBase64?.length ?? 0,
    localContextBlockLen: opts.localContextLen,
    payloadJsonBytes: opts.payloadJsonBytes,
    debugExtractedText: evidence.extractedText?.slice(0, 80),
  });
}
