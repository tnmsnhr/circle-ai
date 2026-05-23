import type { ExtractedContext } from "../types.js";
import { buildCanonicalUrl } from "./canonicalUrl.js";

export interface PageContextPayload {
  contextBlock: string;
  page: {
    canonicalUrl: string;
    title: string;
    domain: string;
  };
}

/** Page-level block only — no nav/footer; title, h1, meta from extraction. */
export function buildPageContext(
  extracted: ExtractedContext
): PageContextPayload {
  const canonicalUrl = buildCanonicalUrl(extracted.source.url);
  const lines: string[] = [];

  if (extracted.context.pageTitle) {
    lines.push(`Title: ${extracted.context.pageTitle}`);
  }
  if (extracted.context.h1) {
    lines.push(`H1: ${extracted.context.h1}`);
  }
  if (extracted.context.metaDescription) {
    lines.push(`Description: ${extracted.context.metaDescription}`);
  }
  lines.push(`Domain: ${extracted.source.domain}`);

  return {
    contextBlock: lines.join("\n"),
    page: {
      canonicalUrl,
      title: extracted.context.pageTitle || extracted.source.title,
      domain: extracted.source.domain,
    },
  };
}
