export const DEFAULT_SETTINGS = {
  theme: "system",
  enabled: true,
};

export function loadSettings() {
  return new Promise((resolve) => {
    try {
      chrome.storage.sync.get(DEFAULT_SETTINGS, (items) => {
        resolve({ ...DEFAULT_SETTINGS, ...items });
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
