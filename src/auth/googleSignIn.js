import { getApiBaseUrl } from "../config/api.js";
import { clearSession, saveSession } from "./session.js";

function getGoogleAccessToken() {
  return new Promise((resolve, reject) => {
    if (!chrome.identity?.getAuthToken) {
      reject(
        new Error(
          "chrome.identity unavailable — add identity permission and oauth2 to manifest.json"
        )
      );
      return;
    }
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!token) {
        reject(new Error("No Google access token returned"));
        return;
      }
      resolve(token);
    });
  });
}

function removeCachedGoogleToken(token) {
  return new Promise((resolve) => {
    if (!chrome.identity?.removeCachedAuthToken) {
      resolve();
      return;
    }
    chrome.identity.removeCachedAuthToken({ token }, () => resolve());
  });
}

/**
 * Sign in with Google via chrome.identity, exchange for Syncle session JWT.
 * @returns {Promise<{ token: string, user: { sub: string, email?: string } }>}
 */
export async function signInWithGoogle() {
  const accessToken = await getGoogleAccessToken();
  const base = await getApiBaseUrl();

  const res = await fetch(`${base}/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Sign-in failed (${res.status})`);
  }

  const data = await res.json();
  await saveSession({
    token: data.token,
    user: data.user,
    signedInAt: new Date().toISOString(),
  });
  return data;
}

export async function signOut() {
  try {
    const token = await new Promise((resolve) => {
      chrome.identity.getAuthToken({ interactive: false }, resolve);
    });
    if (token) await removeCachedGoogleToken(token);
  } catch {
    /* ignore */
  }
  await clearSession();
}
