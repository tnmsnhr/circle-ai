// vite.config.js
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        content: "src/content-script.jsx", // 👈 must match the filename above
      },
      output: {
        entryFileNames: (chunk) =>
          chunk.name === "content" ? "content-script.js" : "[name].js", // 👈 forces dist/content-script.js
        assetFileNames: "assets/[name][extname]",
        chunkFileNames: "assets/[name].js",
      },
    },
  },
});
