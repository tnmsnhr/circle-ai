import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Single-file content script (no extra chunks — required for MV3).
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: false,
    sourcemap: process.env.VITE_KEEP_DIST === "1",
    minify: process.env.VITE_KEEP_DIST !== "1",
    lib: {
      entry: "src/content-script.jsx",
      name: "CircleAIContent",
      formats: ["iife"],
      fileName: () => "content-script.js",
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        extend: true,
      },
    },
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
});
