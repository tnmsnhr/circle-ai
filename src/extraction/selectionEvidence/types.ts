export type CandidateType =
  | "text-token"
  | "text-fragment"
  | "region"
  | "code-block"
  | "heading"
  | "button"
  | "link"
  | "tab"
  | "media"
  | "structured"
  | "element";

export type SelectionSubType = "large_code_block";

export type CandidateUiRole =
  | "region"
  | "heading"
  | "metadata"
  | "action"
  | "tab"
  | "status"
  | "link"
  | "button"
  | "image"
  | "avatar"
  | "table-cell"
  | "form-control"
  | "card"
  | "unknown";

export interface SelectionCandidateRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface SelectionCandidateMetadata {
  tagName?: string;
  role?: string;
  uiRole?: CandidateUiRole;
  alt?: string;
  title?: string;
  caption?: string;
  isPartialMedia?: boolean;
  regionType?: string;
}

export interface SelectionCandidate {
  id: string;
  type: CandidateType;
  text?: string;
  uiRole?: CandidateUiRole;
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
  isStructuredRegion?: boolean;
  isLargeCodeBlock?: boolean;
  isSectionHeading?: boolean;
  selectionSubType?: SelectionSubType;
}
