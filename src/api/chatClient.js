/**
 * Vendor-neutral Syncle chat API — frontend only talks to syncle-services.
 */
import { apiFetch } from "./apiFetch.js";
import { SCHEMA_VERSION, EXTRACTOR_VERSION } from "../extraction/constants.ts";

/**
 * @param {{ pageContextId: string, selectionContextId: string, message: string }} params
 * @returns {Promise<{ reply: string, provider: string, model: string }>}
 */
export async function sendChatMessage({
  pageContextId,
  selectionContextId,
  message,
}) {
  const res = await apiFetch("/chat", {
    method: "POST",
    body: JSON.stringify({
      schemaVersion: SCHEMA_VERSION,
      extractorVersion: EXTRACTOR_VERSION,
      pageContextId,
      selectionContextId,
      message,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Chat failed (${res.status})`);
  }

  return res.json();
}

export async function isAiChatAvailable() {
  try {
    const res = await apiFetch("/ai/status");
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.configured);
  } catch {
    return false;
  }
}
