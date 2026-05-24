// background.js

const OFFSCREEN_URL = chrome.runtime.getURL("offscreen.html");

async function ensureOffscreen() {
  // Create offscreen document only if it doesn't already exist
  if (chrome.offscreen?.hasDocument) {
    const has = await chrome.offscreen.hasDocument();
    if (has) return;
  }
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: ["BLOBS"], // any valid reason is fine; we just need a page context
    justification: "Prepare OCR worker without blocking the page."
  });
}

chrome.runtime.onInstalled.addListener(() => {
  console.log("[syncle] background installed & running");
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "SYNCLE_FETCH") {
    (async () => {
      const { url, method = "GET", headers = {}, body, timeoutMs = 30000 } =
        msg.payload || {};
      if (!url) {
        sendResponse({ ok: false, networkError: "SYNCLE_FETCH: missing url" });
        return;
      }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url, {
          method,
          headers,
          body: body ?? undefined,
          signal: controller.signal,
        });
        const text = await res.text();
        sendResponse({
          ok: res.ok,
          status: res.status,
          body: text,
        });
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        const networkError =
          err.name === "AbortError"
            ? `Request timed out after ${timeoutMs}ms`
            : err.message;
        console.warn("[syncle] SYNCLE_FETCH failed:", url, networkError);
        sendResponse({ ok: false, status: 0, networkError });
      } finally {
        clearTimeout(timer);
      }
    })();
    return true;
  }

  if (msg?.type === "PING") {
    sendResponse({ ok: true, from: "background", ts: Date.now() });
    return;
  }

  if (msg?.type === "OFFSCREEN_PING") {
    (async () => {
      try {
        await ensureOffscreen();
        const res = await chrome.runtime.sendMessage({ type: "OFFSCREEN_PING" });
        sendResponse(res);
      } catch (e) {
        console.error("OFFSCREEN_PING error:", e);
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true; // keep channel open for async sendResponse
  }

    if (msg?.type === "CAPTURE_TEST") {
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });

        await ensureOffscreen();
        const dims = await chrome.runtime.sendMessage({
          type: "OFFSCREEN_READ_IMAGE_DIMS",
          payload: { dataUrl }
        });

        // We can optionally also return current DPR from the page later.
        sendResponse({ ok: true, ...dims });
      } catch (e) {
        console.error("CAPTURE_TEST error:", e);
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true;
  }

  if (msg?.type === "EXTRACTION_CAPTURE_CROP") {
    (async () => {
      try {
        const {
          rect,
          devicePixelRatio = 1,
          maxWidth = 1280,
          quality = 0.82,
        } = msg.payload || {};
        if (!rect || rect.width < 1 || rect.height < 1) {
          throw new Error("EXTRACTION_CAPTURE_CROP: invalid rect");
        }

        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        if (!tab?.windowId) {
          throw new Error("No active tab for capture");
        }

        const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
          format: "png",
        });

        await ensureOffscreen();
        const result = await chrome.runtime.sendMessage({
          type: "OFFSCREEN_CROP_RECT",
          payload: { dataUrl, rect, devicePixelRatio, maxWidth, quality },
        });

        if (result?.error) {
          throw new Error(result.error);
        }

        sendResponse({
          ok: true,
          cropImageBase64: result.cropImageBase64,
          width: result.width,
          height: result.height,
        });
      } catch (e) {
        console.error("EXTRACTION_CAPTURE_CROP error:", e);
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true;
  }

  if (msg?.type === "CROP_TEST") {
  (async () => {
    try {
      const { polygon, dpr = 1, withPreview = false } = msg.payload || {};
      if (!Array.isArray(polygon) || polygon.length < 3) {
        throw new Error("CROP_TEST: polygon must have >= 3 points in CSS pixels");
      }

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });

      await ensureOffscreen();
      const result = await chrome.runtime.sendMessage({
        type: "OFFSCREEN_CROP",
        payload: { dataUrl, polygon, dpr, withPreview }
      });

      sendResponse({ ok: true, ...result });
    } catch (e) {
      console.error("CROP_TEST error:", e);
      sendResponse({ ok: false, error: String(e) });
    }
  })();
  return true;
}
});
