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
  // Use a very high z-index container that sits at document root
  host.style.position = "absolute";
  host.style.left = "0";
  host.style.top = "0";
  host.style.width = "0";
  host.style.height = "0";
  host.style.zIndex = "2147483647";

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

  // Ensure the host follows the document size by pinning at 0,0.
  // The inner component sizes to full page and will scroll naturally with the document.
})();
