import React from "react";
import { createRoot } from "react-dom/client";
import OverlayApp from "./OverlayApp.jsx";
import "./overlay.css";

/**
 * Inject a Shadow DOM root to isolate styles from the host page.
 * Mount the React OverlayApp there.
 */
(function inject() {
  // Avoid duplicate mounts
  if (window.__DRAW_ON_WEB_MOUNTED__) return;
  window.__DRAW_ON_WEB_MOUNTED__ = true;
  console.log("OverlayApp");

  const host = document.createElement("div");
  host.setAttribute("id", "draw-on-web-root-host");
  // Viewport-fixed layer; selections track page content via DOM anchor + getBoundingClientRect.
  host.style.cssText = [
    "position:fixed",
    "inset:0",
    "width:100vw",
    "height:100vh",
    "overflow:hidden",
    "pointer-events:none",
    "z-index:2147483647",
  ].join(";");

  document.documentElement.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });

  // Create a container inside Shadow DOM that spans the viewport; OverlayApp will size its SVG to page size.
  const mount = document.createElement("div");
  shadow.appendChild(mount);

  // Inject isolated stylesheet into Shadow DOM
  const style = document.createElement("style");
  style.textContent = ""; // placeholder; Vite bundles CSS import below
  shadow.appendChild(style);

  // Move our built CSS into shadow by cloning <style> created by Vite in document <head>.
  // (Vite will have appended a <style> tag for overlay.css; copy its text here to isolate.)
  const viteStyle = [...document.querySelectorAll("style")].find(
    (s) => s.textContent && s.textContent.includes(".draw-root")
  );
  if (viteStyle) {
    style.textContent = viteStyle.textContent;
  }

  const root = createRoot(mount);
  root.render(<OverlayApp />);

  // OverlayApp renders in viewport space, pinned to DOM anchors under each selection.
  chrome.runtime.sendMessage({ type: "OFFSCREEN_PING" }, (res) => {
    console.log("[circle-ai] offscreen pong:", res);
  });
  chrome.runtime.sendMessage({ type: "CAPTURE_TEST" }, (res) => {
    console.log("[circle-ai] capture test:", res);
  });

  /* global chrome */

  // helper to create a small test rectangle in CSS px at viewport center
  function debugRect(w = 200, h = 120) {
    const vw = Math.min(
      window.innerWidth,
      document.documentElement.clientWidth || window.innerWidth
    );
    const vh = Math.min(
      window.innerHeight,
      document.documentElement.clientHeight || window.innerHeight
    );
    const cx = Math.floor(vw / 2),
      cy = Math.floor(vh / 2);
    const left = cx - Math.floor(w / 2);
    const top = cy - Math.floor(h / 2);
    return [
      { x: left, y: top },
      { x: left + w, y: top },
      { x: left + w, y: top + h },
      { x: left, y: top + h },
    ];
  }

  // --- test call: replace `polygon` with your lasso points ---
  const polygon = debugRect(260, 160); // or yourPointsArrayInCssPixels
  const dpr = window.devicePixelRatio || 1;

  // withPreview=true returns a dataURL so you can visually confirm
  // chrome.runtime.sendMessage(
  //   { type: "CROP_TEST", payload: { polygon, dpr, withPreview: true } },
  //   (res) => {
  //     console.log("[circle-ai] CROP_TEST:", res);
  //     if (res?.ok && res.dataUrl) {
  //       // quick visual confirmation: append preview image
  //       const img = document.createElement("img");
  //       img.src = res.dataUrl;
  //       img.style.position = "fixed";
  //       img.style.right = "12px";
  //       img.style.bottom = "12px";
  //       img.style.maxWidth = "30vw";
  //       img.style.maxHeight = "30vh";
  //       img.style.border = "1px solid #888";
  //       img.style.zIndex = "999999";
  //       document.body.appendChild(img);
  //     }
  //   }
  // );
})();
