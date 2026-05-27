/** Map internal reason codes to public mechanical signal names. */
const REASON_TO_SIGNAL: Record<string, string> = {
  "center-in-polygon": "center-inside-selection-polygon",
  "intersects-polygon": "rect-intersects-selection-polygon",
  "bbox-only": "bbox-only-fallback",
  "high-overlap": "overlap-ratio",
  "high-polygon-cover": "overlap-ratio",
  "near-lasso-center": "near-selection-center",
  "same-line-as-center": "same-line-as-selection-center",
  "inline-styled": "inline-code-style",
  "compact-token": "compact-token",
  "weak-token": "weak-token",
  "broken-fragment": "broken-fragment",
  "long-chunk": "huge-paragraph-fragment",
  "long-for-small-selection": "huge-paragraph-fragment",
  "partial-media": "partial-media",
  media: "media-overlap",
  structured: "table-cell/value",
  "text-range": "text-fragment",
  "char-run": "text-fragment",
  "polygon-span": "text-fragment",
  "center-line": "text-fragment",
  "element-fallback": "bbox-only-fallback",
  "no-hit": "far-from-center",
  "large-selection": "large-selection",
  "region-candidate": "region-candidate",
  "grouped-control": "grouped-control",
  "inside-selection": "inside-selection",
  "selected-container": "selected-container",
  "contains-heading": "contains-heading",
  "contains-actions": "contains-actions",
  "contains-metadata": "contains-metadata",
  "contains-tabs": "contains-tabs",
  "code-block": "code-block",
  monospace: "monospace",
  "multi-line-code": "multi-line-code",
  "structural-element": "structural-element",
  "phrase-expanded": "phrase-expanded",
  "section-title": "section-title",
  "phrase-length-ok": "phrase-length-ok",
};

export function mapSignals(reasonCodes: string[]): string[] {
  const out = new Set<string>();
  for (const code of reasonCodes) {
    out.add(REASON_TO_SIGNAL[code] ?? code);
  }
  return [...out];
}
