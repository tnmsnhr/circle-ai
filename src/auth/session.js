const SESSION_KEY = "syncle_session";

export function loadSession() {
  return new Promise((resolve) => {
    chrome.storage.local.get(SESSION_KEY, (items) => {
      resolve(items[SESSION_KEY] ?? null);
    });
  });
}

export function saveSession(session) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [SESSION_KEY]: session }, () => resolve());
  });
}

export function clearSession() {
  return new Promise((resolve) => {
    chrome.storage.local.remove(SESSION_KEY, () => resolve());
  });
}

export async function isSignedIn() {
  const session = await loadSession();
  return Boolean(session?.token);
}

export async function getAuthHeaders() {
  const session = await loadSession();
  if (!session?.token) return {};
  return { Authorization: `Bearer ${session.token}` };
}
