// background.js

// Log when the extension is installed/updated
chrome.runtime.onInstalled.addListener(() => {
  console.log("[circle-ai] background installed & running");
});

// Simple ping/pong so other parts can verify background is alive
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "PING") {
    sendResponse({ ok: true, from: "background", ts: Date.now() });
    return; // sync response, no need to keep channel open
  }
});

// Click the extension icon -> inject a tiny script into the active tab
// This proves the background can talk to pages.
chrome.action.onClicked.addListener(async (tab) => {
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        console.log("[circle-ai] injected from background.js");
        alert("circle-ai background is alive ✅");
      }
    });
  } catch (e) {
    console.error("[circle-ai] injection failed:", e);
  }
});
