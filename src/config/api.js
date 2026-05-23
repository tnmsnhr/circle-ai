export const DEFAULT_API_BASE = "http://localhost:3001";

export function getApiBaseUrl() {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get({ apiBaseUrl: DEFAULT_API_BASE }, (items) => {
        resolve(items.apiBaseUrl || DEFAULT_API_BASE);
      });
    } catch {
      resolve(DEFAULT_API_BASE);
    }
  });
}

export function setApiBaseUrl(url) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ apiBaseUrl: url }, () => resolve());
  });
}
