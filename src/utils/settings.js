import { DEFAULT_LASSO_THEME_ID } from "./lassoThemes.js";

export const DEFAULT_SETTINGS = {
  theme: "system",
  enabled: true,
  lassoTheme: DEFAULT_LASSO_THEME_ID,
  autoCollapse: true,
  /** When true: register + OpenAI chat. When false: local DOM extract + console only. */
  aiEnabled: true,
};

export function loadSettings() {
  return new Promise((resolve) => {
    try {
      chrome.storage.sync.get(DEFAULT_SETTINGS, (items) => {
        const merged = { ...DEFAULT_SETTINGS, ...items };
        if (!merged.lassoTheme) {
          merged.lassoTheme = DEFAULT_LASSO_THEME_ID;
        }
        resolve(merged);
      });
    } catch {
      resolve({ ...DEFAULT_SETTINGS });
    }
  });
}

/** Only an explicit `false` disables drawing. */
export function isDrawingEnabled(settings) {
  return settings?.enabled !== false;
}

/** Only an explicit `false` disables scroll auto-collapse. */
export function isAutoCollapseEnabled(settings) {
  return settings?.autoCollapse !== false;
}

/** Only an explicit `false` disables AI (backend + OpenAI). */
export function isAiEnabled(settings) {
  return settings?.aiEnabled !== false;
}

export function saveSettings(partial) {
  return new Promise((resolve) => {
    chrome.storage.sync.set(partial, () => resolve());
  });
}

export function applyThemeToDocument(theme) {
  const root = document.documentElement;
  root.dataset.theme =
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;
}
