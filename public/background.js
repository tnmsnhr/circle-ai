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
  console.log("[circle-ai] background installed & running");
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
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
});
