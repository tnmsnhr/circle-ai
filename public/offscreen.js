// offscreen.js
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "OFFSCREEN_PING") {
    sendResponse({ ok: true, from: "offscreen", ts: Date.now() });
  }

  if (msg?.type === "OFFSCREEN_READ_IMAGE_DIMS") {
    (async () => {
      try {
        const { dataUrl } = msg.payload;
        const blob = await (await fetch(dataUrl)).blob();
        const bmp = await createImageBitmap(blob);
        sendResponse({ width: bmp.width, height: bmp.height });
      } catch (e) {
        sendResponse({ error: String(e) });
      }
    })();
    return true;
  }
});
  