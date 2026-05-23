import { getApiBaseUrl } from "../config/api.js";
import { clearSession, loadSession, saveSession } from "./session.js";

function parseTokenFromRedirect(responseUrl) {
  const url = new URL(responseUrl);
  const params = new URLSearchParams(url.hash ? url.hash.slice(1) : url.search.slice(1));
  const token = params.get("token");
  if (!token) {
    const err = params.get("error_description") || params.get("error");
    throw new Error(err || "Sign-in was cancelled");
  }
  return {
    token,
    email: params.get("email") || undefined,
  };
}

function launchChromeOAuth(startUrl) {
  return new Promise((resolve, reject) => {
    if (!chrome.identity?.launchWebAuthFlow) {
      reject(new Error("chrome.identity.launchWebAuthFlow is unavailable"));
      return;
    }
    chrome.identity.launchWebAuthFlow(
      { url: startUrl, interactive: true },
      (responseUrl) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!responseUrl) {
          reject(new Error("Sign-in was cancelled"));
          return;
        }
        try {
          resolve(parseTokenFromRedirect(responseUrl));
        } catch (e) {
          reject(e);
        }
      }
    );
  });
}

export async function isCloudSignInAvailable() {
  try {
    const base = await getApiBaseUrl();
    const res = await fetch(`${base}/auth/status`, { cache: "no-store" });
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.googleSignIn && data.browserOAuth !== false);
  } catch {
    return false;
  }
}

async function validateSession(session) {
  if (!session?.token) return null;
  try {
    const base = await getApiBaseUrl();
    const res = await fetch(`${base}/auth/me`, {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return { token: session.token, user: data.user };
  } catch {
    return null;
  }
}

/** Restore existing Syncle session (no Google prompt). */
export async function trySilentGoogleSignIn() {
  const existing = await loadSession();
  return validateSession(existing);
}

/**
 * One-click sign-in — opens Google account picker via syncle-services.
 * OAuth client ID lives on the server only.
 */
export async function signInWithGoogle() {
  const base = await getApiBaseUrl();
  const redirectUri = chrome.identity.getRedirectURL();
  const startUrl = `${base}/auth/google/start?redirect_uri=${encodeURIComponent(redirectUri)}`;

  const { token, email } = await launchChromeOAuth(startUrl);

  let user = { email };
  try {
    const meRes = await fetch(`${base}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (meRes.ok) {
      const me = await meRes.json();
      user = me.user ?? user;
    }
  } catch {
    /* use email from redirect */
  }

  const session = {
    token,
    user,
    signedInAt: new Date().toISOString(),
  };
  await saveSession(session);
  return session;
}

export async function signOut() {
  await clearSession();
}
