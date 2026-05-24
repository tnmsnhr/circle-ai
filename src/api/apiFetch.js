/**
 * Fetch syncle-services via the extension background worker (with direct fallback).
 */
import { getApiBaseUrl } from "../config/api.js";
import { getAuthHeaders } from "../auth/session.js";

const DEFAULT_TIMEOUT_MS = 30000;
const MESSAGE_TIMEOUT_MS = 35000;

function parseResponse(ok, status, bodyText) {
  return {
    ok: Boolean(ok),
    status: status ?? 0,
    json: async () => {
      if (!bodyText) return {};
      try {
        return JSON.parse(bodyText);
      } catch {
        return {};
      }
    },
    text: async () => bodyText,
  };
}

function sendMessageWithTimeout(message, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Extension background did not respond within ${timeoutMs}ms`));
    }, timeoutMs);

    chrome.runtime.sendMessage(message, (res) => {
      clearTimeout(timer);
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(res);
    });
  });
}

async function fetchViaBackground(url, options) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
    ...(await getAuthHeaders()),
  };

  const response = await sendMessageWithTimeout(
    {
      type: "SYNCLE_FETCH",
      payload: {
        url,
        method: options.method || "GET",
        headers,
        body: options.body,
        timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      },
    },
    MESSAGE_TIMEOUT_MS
  );

  if (!response) {
    throw new Error("No response from extension background");
  }

  if (response.networkError) {
    throw new Error(response.networkError);
  }

  const bodyText = typeof response.body === "string" ? response.body : "";
  return parseResponse(response.ok, response.status, bodyText);
}

async function fetchDirect(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  );
  try {
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
      ...(await getAuthHeaders()),
    };
    const res = await fetch(url, {
      method: options.method || "GET",
      headers,
      body: options.body,
      signal: controller.signal,
    });
    const bodyText = await res.text();
    return parseResponse(res.ok, res.status, bodyText);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {string} path e.g. "/chat" or full URL
 * @param {{ method?: string, body?: string, headers?: Record<string, string>, timeoutMs?: number }} [options]
 */
export async function apiFetch(path, options = {}) {
  const base = await getApiBaseUrl();
  const url = path.startsWith("http") ? path : `${base}${path}`;

  try {
    return await fetchViaBackground(url, options);
  } catch (bgErr) {
    console.warn("[syncle] background fetch failed, trying direct:", bgErr);
    try {
      return await fetchDirect(url, options);
    } catch (directErr) {
      const bgMsg = bgErr instanceof Error ? bgErr.message : String(bgErr);
      const directMsg =
        directErr instanceof Error ? directErr.message : String(directErr);
      throw new Error(
        `${directMsg} — is syncle-services running on ${base}? (background: ${bgMsg})`
      );
    }
  }
}
