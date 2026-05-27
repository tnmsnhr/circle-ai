/** Overlay product lines — only `ai` is fully implemented today. */
export const PRODUCT_MODES = {
  AI: "ai",
  CLIPS: "clips",
  PAGE: "page",
};

export const PRODUCT_MODE_LIST = [
  {
    id: PRODUCT_MODES.AI,
    label: "AI summary",
    shortLabel: "AI",
    title: "AI summary + memory — hold ⌘ or Ctrl and drag to select",
  },
  {
    id: PRODUCT_MODES.CLIPS,
    label: "Save clips",
    shortLabel: "Save",
    title: "Save content from the page for later reference (coming soon)",
  },
  {
    id: PRODUCT_MODES.PAGE,
    label: "Page summary",
    shortLabel: "Page",
    title: "Summarize the full page (coming soon)",
  },
];

export function isAiProductMode(mode) {
  return mode === PRODUCT_MODES.AI;
}
