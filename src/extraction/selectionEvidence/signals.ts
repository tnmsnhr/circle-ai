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
};

export function mapSignals(reasonCodes: string[]): string[] {
  const out = new Set<string>();
  for (const code of reasonCodes) {
    out.add(REASON_TO_SIGNAL[code] ?? code);
  }
  return [...out];
}
