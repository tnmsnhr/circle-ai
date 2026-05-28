export type FocusExtractionMethod = "media-crop" | "visual-fallback";

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

export type SourceType = "webpage";
export type ExtractionStrategy = "visual-primary";

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
    extractionMethod?: FocusExtractionMethod;
    uncertain?: boolean;
  };
  context: {
    pageTitle: string;
    metaDescription?: string;
    h1?: string;
  };
  media: { images: [] };
  meta: {
    selectionRect: SelectionRect;
    selectionPolygon?: Point2D[];
    viewport: ViewportMeta;
    extractionStrategy: ExtractionStrategy;
    capturedAt: string;
  };
  selectionEvidence?: import("./selectionEvidence/types.js").SelectionEvidence;
  optimizedPayload?: import("./optimizePayload.js").OptimizedAiPayload;
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
