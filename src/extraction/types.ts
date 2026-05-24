export type FocusExtractionMethod =
  | "token-polygon"
  | "token-bbox"
  | "element-fallback"
  | "media-crop"
  | "visual-fallback";

export interface Point2D {
  x: number;
  y: number;
}

export interface SelectionRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface ViewportMeta {
  width: number;
  height: number;
  devicePixelRatio: number;
}

export type SourceType =
  | "webpage"
  | "image"
  | "svg"
  | "canvas"
  | "pdf"
  | "mixed";

export type ExtractionStrategy =
  | "dom-text-only"
  | "dom-with-context"
  | "visual-primary"
  | "visual-with-dom"
  | "pdf-text"
  | "pdf-visual-fallback"
  | "mixed";

export interface ExtractedLink {
  text: string;
  href: string;
}

export interface ExtractedImageMeta {
  src: string;
  alt: string;
  title: string;
  figcaption?: string;
  /** True when selection covers less than ~85% of image area. */
  isPartialSelection?: boolean;
}

export interface ExtractedSvgMeta {
  title?: string;
  desc?: string;
  text?: string;
  /** Truncated outerHTML for inline SVG only. */
  outerHTML?: string;
}

export interface ExtractedPdfMeta {
  pageNumber?: number;
  selectedText?: string;
  nearbyText?: string;
}

/** Optional: attached by buildExtractedContext for chat/AI. */
export type { AiSelectionPayload } from "./buildAiPayload.js";

export interface ExtractedContext {
  source: {
    type: SourceType;
    url: string;
    title: string;
    domain: string;
  };
  focus: {
    text: string;
    cropImageBase64?: string;
    elementTypes: string[];
    confidence?: number;
    extractionMethod?: FocusExtractionMethod;
    uncertain?: boolean;
  };
  context: {
    nearbyText: string;
    ancestorText: string;
    headings: string[];
    captions: string[];
    links: ExtractedLink[];
    tableHeaders: string[];
    pageTitle: string;
    metaDescription?: string;
    h1?: string;
  };
  media: {
    images: ExtractedImageMeta[];
    svg?: ExtractedSvgMeta[];
    pdf?: ExtractedPdfMeta;
  };
  meta: {
    selectionRect: SelectionRect;
    /** Lasso polygon in viewport client coordinates (when drawn freehand). */
    selectionPolygon?: Point2D[];
    viewport: ViewportMeta;
    extractionStrategy: ExtractionStrategy;
    capturedAt: string;
  };
  /** Labeled payload for AI — userSelection vs surroundingContext. */
  aiPayload?: import("./buildAiPayload.js").AiSelectionPayload;
  /** Candidate evidence for AI resolution (mechanical, not semantic). */
  selectionEvidence?: import("./selectionEvidence/types.js").SelectionEvidence;
  /** Pruned payload for syncle-services (plan: OptimizedAiPayload). */
  optimizedPayload?: import("./optimizePayload.js").OptimizedAiPayload;
  /** Backend canonical IDs after register (when signed in). */
  contextIds?: {
    pageContextId: string;
    selectionContextId: string;
  };
}

export interface CaptureCropRequest {
  rect: SelectionRect;
  devicePixelRatio: number;
  maxWidth?: number;
  quality?: number;
}

export interface CaptureCropResponse {
  ok: boolean;
  cropImageBase64?: string;
  width?: number;
  height?: number;
  error?: string;
}
