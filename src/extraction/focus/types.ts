import type { FocusExtractionMethod } from "../types.js";

export type CandidateType =
  | "text-token"
  | "text-range"
  | "text-fragment"
  | "media"
  | "structured"
  | "element";

export interface DOMRectLike {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface ExtractionCandidate {
  type: CandidateType;
  text?: string;
  rect: DOMRectLike;
  element?: Element;
  metadata?: Record<string, unknown>;
  score: number;
  confidence: number;
  reasonCodes: string[];
}

export interface FocusExtractionResult {
  text: string;
  confidence: number;
  extractionMethod: FocusExtractionMethod;
  uncertain: boolean;
  /** Winning candidates for debug. */
  candidates?: ExtractionCandidate[];
}

export interface FocusExtractionContext {
  bbox: import("../types.js").SelectionRect;
  polygon?: import("../types.js").Point2D[];
  lassoCenter: { x: number; y: number };
  selectionArea: number;
  hasPolygon: boolean;
  elements: Element[];
}
