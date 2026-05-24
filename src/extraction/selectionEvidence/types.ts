export type CandidateType =
  | "text-token"
  | "text-fragment"
  | "media"
  | "structured"
  | "element";

export interface SelectionCandidateRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface SelectionCandidateMetadata {
  tagName?: string;
  role?: string;
  alt?: string;
  title?: string;
  caption?: string;
  isPartialMedia?: boolean;
}

export interface SelectionCandidate {
  id: string;
  type: CandidateType;
  text?: string;
  /** Mechanical visual proximity (0–1), not semantic importance. */
  visualWeight: number;
  /** Extraction/mechanical confidence, not semantic confidence. */
  confidence: number;
  signals: string[];
  rect?: SelectionCandidateRect;
  metadata?: SelectionCandidateMetadata;
}

export interface SelectionEvidence {
  candidates: SelectionCandidate[];
  localContextBlock?: string;
  /** Top mechanical hint for debug only — not authoritative for AI. */
  extractedText?: string;
  cropImageBase64?: string;
  cropImageUrl?: string;
  hasVisual: boolean;
  evidenceConfidence: number;
}
