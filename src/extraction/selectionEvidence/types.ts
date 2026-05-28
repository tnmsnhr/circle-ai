/** Minimal selection evidence — visual crop only (no local text candidates). */
export interface SelectionEvidence {
  candidates: [];
  cropImageBase64?: string;
  hasVisual: boolean;
  evidenceConfidence: number;
}
