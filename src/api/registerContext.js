/**
 * Register optimized extraction with syncle-services (page once, selection per pin).
 */
import { apiFetch } from "./apiFetch.js";
import { getPageIdentity } from "../extraction/pageContext/canonicalUrl.ts";
import {
  getPageSession,
  savePageSession,
  saveSelectionSession,
  touchPageSession,
} from "../extraction/pageContext/cache.ts";
import { optimizeForAi } from "../extraction/optimizePayload.ts";

const REGISTER_TIMEOUT_MS = 25000;
const MAX_CROP_CHARS_IN_REGISTER = 0; // omit base64 on register — keeps payload small; text context is enough for chat v1

function slimSelectionForRegister(selection) {
  const slim = { ...selection };
  const evidence = slim.selectionEvidence;
  const crop =
    (evidence && evidence.cropImageBase64) || slim.cropImageBase64;
  if (crop && crop.length > MAX_CROP_CHARS_IN_REGISTER) {
    const { cropImageBase64: _legacy, ...rest } = slim;
    if (rest.selectionEvidence?.cropImageBase64) {
      const { cropImageBase64, ...ev } = rest.selectionEvidence;
      rest.selectionEvidence = { ...ev, hasVisual: true };
    }
    return {
      ...rest,
      meta: {
        ...(rest.meta && typeof rest.meta === "object" ? rest.meta : {}),
        hasImage: true,
      },
    };
  }
  return slim;
}

async function fetchWithTimeout(path, options) {
  return apiFetch(path, { ...options, timeoutMs: REGISTER_TIMEOUT_MS });
}

/**
 * @param {import('../extraction/types').ExtractedContext} extracted
 * @param {string} localPinId
 * @returns {Promise<{ pageContextId: string, selectionContextId: string, optimizedPayload: object } | null>}
 */
/**
 * Register or return existing IDs. Surfaces errors to the UI (no silent fail).
 * @returns {Promise<{ ok: true, pageContextId: string, selectionContextId: string, optimizedPayload: object } | { ok: false, reason: string, message?: string }>}
 */
export async function ensureContextRegistered(extracted, localPinId) {
  try {
    const registered = await registerExtractedContext(extracted, localPinId);
    if (!registered) {
      return {
        ok: false,
        reason: "error",
        message: "Registration failed",
      };
    }
    return { ok: true, ...registered };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not register selection";
    return { ok: false, reason: "error", message };
  }
}

export async function registerExtractedContext(extracted, localPinId) {
  const { pageFingerprint, canonicalUrl } = await getPageIdentity();
  console.info("[syncle] register start", canonicalUrl);
  let pageSession = await getPageSession(pageFingerprint);

  const optimized = optimizeForAi(extracted, {
    localPinId,
    pageFingerprint,
    pageContextId: pageSession?.pageContextId,
  });

  if (optimized.kind === "selection_with_page_context") {
    const res = await fetchWithTimeout("/context/page/register", {
      method: "POST",
      body: JSON.stringify({
        schemaVersion: optimized.schemaVersion,
        extractorVersion: optimized.extractorVersion,
        pageFingerprint,
        canonicalUrl,
        pageContext: optimized.pageContext,
        selection: slimSelectionForRegister(optimized.selection),
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const detail = err.details
        ? ` ${JSON.stringify(err.details)}`
        : "";
      throw new Error(
        (err.error || `Page register failed (${res.status})`) + detail
      );
    }

    const ids = await res.json();
    console.info("[syncle] register ok", ids.pageContextId, ids.selectionContextId);
    pageSession = await savePageSession(pageFingerprint, {
      pageContextId: ids.pageContextId,
      pageFingerprint,
      canonicalUrl,
      pageContextBlock: optimized.pageContext.contextBlock,
    });
    await saveSelectionSession(localPinId, {
      selectionContextId: ids.selectionContextId,
      pageContextId: ids.pageContextId,
      localPinId,
    });

    return {
      pageContextId: ids.pageContextId,
      selectionContextId: ids.selectionContextId,
      optimizedPayload: optimized,
    };
  }

  if (!pageSession) {
    throw new Error("Page context not cached; expected selection_with_page_context first");
  }

  await touchPageSession(pageFingerprint, pageSession);

  const res = await fetchWithTimeout("/context/selection/register", {
    method: "POST",
    body: JSON.stringify({
      schemaVersion: optimized.schemaVersion,
      extractorVersion: optimized.extractorVersion,
      pageContextId: pageSession.pageContextId,
      pageFingerprint,
      selection: slimSelectionForRegister(optimized.selection),
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const detail = err.details ? ` ${JSON.stringify(err.details)}` : "";
    throw new Error(
      (err.error || `Selection register failed (${res.status})`) + detail
    );
  }

  const { selectionContextId } = await res.json();
  await saveSelectionSession(localPinId, {
    selectionContextId,
    pageContextId: pageSession.pageContextId,
    localPinId,
  });

  return {
    pageContextId: pageSession.pageContextId,
    selectionContextId,
    optimizedPayload: optimized,
  };
}
