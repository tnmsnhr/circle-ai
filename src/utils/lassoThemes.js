/** Lasso selection color themes (border + fill). */
export const LASSO_THEMES = [
  {
    id: "emerald",
    name: "Emerald",
    border: "#22c55e",
    fill: "rgba(34, 197, 94, 0.14)",
  },
  {
    id: "ocean",
    name: "Ocean",
    border: "#0ea5e9",
    fill: "rgba(14, 165, 233, 0.14)",
  },
  {
    id: "violet",
    name: "Violet",
    border: "#8b5cf6",
    fill: "rgba(139, 92, 246, 0.14)",
  },
  {
    id: "rose",
    name: "Rose",
    border: "#f43f5e",
    fill: "rgba(244, 63, 94, 0.14)",
  },
  {
    id: "amber",
    name: "Amber",
    border: "#f59e0b",
    fill: "rgba(245, 158, 11, 0.16)",
  },
  {
    id: "teal",
    name: "Teal",
    border: "#14b8a6",
    fill: "rgba(20, 184, 166, 0.14)",
  },
  {
    id: "indigo",
    name: "Indigo",
    border: "#6366f1",
    fill: "rgba(99, 102, 241, 0.14)",
  },
  {
    id: "lime",
    name: "Lime",
    border: "#84cc16",
    fill: "rgba(132, 204, 22, 0.16)",
  },
  {
    id: "fuchsia",
    name: "Fuchsia",
    border: "#d946ef",
    fill: "rgba(217, 70, 239, 0.14)",
  },
  {
    id: "coral",
    name: "Coral",
    border: "#fb7185",
    fill: "rgba(251, 113, 133, 0.14)",
  },
];

export const DEFAULT_LASSO_THEME_ID = "emerald";

export function getLassoTheme(id) {
  return LASSO_THEMES.find((t) => t.id === id) ?? LASSO_THEMES[0];
}
