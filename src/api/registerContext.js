/**
 * Register optimized extraction with syncle-services (page once, selection per pin).
 */
import { getApiBaseUrl } from "../config/api.js";
import { getAuthHeaders, isSignedIn } from "../auth/session.js";
import { getPageIdentity } from "../extraction/pageContext/canonicalUrl.ts";
import {
  getPageSession,
  savePageSession,
  saveSelectionSession,
  touchPageSession,
} from "../extraction/pageContext/cache.ts";
import { optimizeForAi } from "../extraction/optimizePayload.ts";

/**
 * @param {import('../extraction/types').ExtractedContext} extracted
 * @param {string} localPinId
 * @returns {Promise<{ pageContextId: string, selectionContextId: string, optimizedPayload: object } | null>}
 */
export async function registerExtractedContext(extracted, localPinId) {
  if (!(await isSignedIn())) {
    return null;
  }

  const { pageFingerprint, canonicalUrl } = await getPageIdentity();
  let pageSession = await getPageSession(pageFingerprint);

  const optimized = optimizeForAi(extracted, {
    localPinId,
    pageFingerprint,
    pageContextId: pageSession?.pageContextId,
  });

  const base = await getApiBaseUrl();
  const headers = {
    "Content-Type": "application/json",
    ...(await getAuthHeaders()),
  };

  if (optimized.kind === "selection_with_page_context") {
    const res = await fetch(`${base}/context/page/register`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        schemaVersion: optimized.schemaVersion,
        extractorVersion: optimized.extractorVersion,
        pageFingerprint,
        canonicalUrl,
        pageContext: optimized.pageContext,
        selection: optimized.selection,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Page register failed (${res.status})`);
    }

    const ids = await res.json();
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

  const res = await fetch(`${base}/context/selection/register`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      schemaVersion: optimized.schemaVersion,
      extractorVersion: optimized.extractorVersion,
      pageContextId: pageSession.pageContextId,
      pageFingerprint,
      selection: optimized.selection,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Selection register failed (${res.status})`);
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
