import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// Popup only — content script is built separately as one IIFE file.
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: process.env.VITE_KEEP_DIST === "1" ? false : true,
    sourcemap: process.env.VITE_KEEP_DIST === "1",
    minify: process.env.VITE_KEEP_DIST !== "1",
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "popup.html"),
      },
    },
  },
});
