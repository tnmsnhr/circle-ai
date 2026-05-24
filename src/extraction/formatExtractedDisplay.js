/**
 * Format local extraction for the popup — no server/AI required.
 * @param {import('./types').ExtractedContext | undefined} extracted
 * @returns {{ title: string, sections: Array<{ label: string, body: string }> }}
 */
export function formatExtractedForDisplay(extracted) {
  if (!extracted) {
    return { title: "No extraction", sections: [] };
  }

  const sections = [];
  const evidence = extracted.selectionEvidence;
  const focus = extracted.focus?.text?.trim() ?? "";

  if (evidence?.candidates?.length) {
    const lines = evidence.candidates.map((c) => {
      const w = Math.round((c.visualWeight ?? 0) * 100);
      const sig = (c.signals ?? []).slice(0, 4).join(", ");
      const t = c.text?.trim() || c.type;
      return `• ${t} (visual ${w}%, ${c.type})${sig ? ` — ${sig}` : ""}`;
    });
    sections.push({
      label: "Selection candidates (mechanical)",
      body: lines.join("\n"),
    });
    if (evidence.evidenceConfidence != null) {
      sections.push({
        label: "Evidence confidence",
        body: `${Math.round(evidence.evidenceConfidence * 100)}% — AI resolves intended target from candidates.`,
      });
    }
  } else if (focus) {
    sections.push({ label: "Selected text (debug hint)", body: focus });
  } else if (extracted.focus?.cropImageBase64 || evidence?.cropImageBase64) {
    sections.push({
      label: "Selection",
      body: "Visual selection (crop captured).",
    });
  } else {
    sections.push({ label: "Selection", body: "(empty or non-text selection)" });
  }

  if (evidence?.localContextBlock?.trim()) {
    sections.push({
      label: "Local context",
      body: evidence.localContextBlock.trim(),
    });
  }

  const ctx = extracted.context ?? {};
  if (!evidence?.localContextBlock && ctx.nearbyText?.trim()) {
    sections.push({ label: "Nearby context", body: ctx.nearbyText.trim() });
  }
  if (ctx.headings?.length) {
    sections.push({
      label: "Headings",
      body: ctx.headings.filter(Boolean).join("\n"),
    });
  }

  const meta = extracted.meta ?? {};
  const source = extracted.source ?? {};
  const metaLines = [
    source.title && `Page: ${source.title}`,
    source.url && `URL: ${source.url}`,
    meta.extractionStrategy && `Strategy: ${meta.extractionStrategy}`,
    extracted.focus?.extractionMethod &&
      `Extraction method: ${extracted.focus.extractionMethod}`,
    evidence?.evidenceConfidence != null &&
      `Evidence confidence: ${Math.round(evidence.evidenceConfidence * 100)}%`,
  ].filter(Boolean);

  if (metaLines.length) {
    sections.push({ label: "Page & extraction", body: metaLines.join("\n") });
  }

  const topText =
    evidence?.candidates?.[0]?.text?.trim() ||
    focus ||
    "";
  const title =
    topText.slice(0, 60) + (topText.length > 60 ? "…" : "") ||
    source.title ||
    "Selection";

  return { title, sections };
}

/**
 * @param {import('./types').ExtractedContext | undefined} extracted
 * @returns {string}
 */
export function extractedToPlainText(extracted) {
  const { sections } = formatExtractedForDisplay(extracted);
  return sections.map((s) => `${s.label}\n${s.body}`).join("\n\n");
}
