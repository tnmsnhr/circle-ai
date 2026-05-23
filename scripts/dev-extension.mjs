#!/usr/bin/env node
/**
 * Watch source files and rebuild dist/ for unpacked extension development.
 * Chrome still needs an extension reload + tab refresh (see README).
 */
import { spawn } from "node:child_process";
import { cp, mkdir, rm, stat } from "node:fs/promises";
import { watch } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const publicDir = path.join(root, "public");
const distDir = path.join(root, "dist");

const env = {
  ...process.env,
  VITE_KEEP_DIST: "1",
  NODE_ENV: "development",
};

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function copyExtFiles() {
  await mkdir(distDir, { recursive: true });
  await cp(path.join(publicDir, "manifest.json"), path.join(distDir, "manifest.json"));
  await cp(path.join(publicDir, "background.js"), path.join(distDir, "background.js"));
  await cp(path.join(publicDir, "offscreen.html"), path.join(distDir, "offscreen.html"));
  await cp(path.join(publicDir, "offscreen.js"), path.join(distDir, "offscreen.js"));

  const icon = path.join(publicDir, "icon.png");
  if (await exists(icon)) {
    await cp(icon, path.join(distDir, "icon.png"));
  }

  const iconsDir = path.join(publicDir, "icons");
  if (await exists(iconsDir)) {
    await mkdir(path.join(distDir, "icons"), { recursive: true });
    await cp(iconsDir, path.join(distDir, "icons"), { recursive: true });
  }
}

function run(cmd, args, label) {
  const child = spawn(cmd, args, {
    cwd: root,
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  child.on("exit", (code, signal) => {
    if (signal) return;
    if (code !== 0 && code !== null) {
      console.error(`[dev:ext] ${label} exited with code ${code}`);
      process.exit(code);
    }
  });
  return child;
}

let copyTimer = null;
function scheduleCopy() {
  if (copyTimer) clearTimeout(copyTimer);
  copyTimer = setTimeout(async () => {
    copyTimer = null;
    await copyExtFiles();
    console.log("[dev:ext] Copied public/ → dist/");
  }, 80);
}

const children = [];

function shutdown() {
  for (const child of children) {
    child.kill("SIGTERM");
  }
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log(`
[dev:ext] Circle AI — extension dev watch
────────────────────────────────────────
  • Rebuilds dist/ when you save src/ or popup.html
  • Load unpacked from dist/ once in chrome://extensions

  After each rebuild:
    1. Reload the extension (↻ on chrome://extensions)
       Tip: install "Extensions Reloader" for a keyboard shortcut
    2. Refresh the webpage (content scripts inject on page load)

  Press Ctrl+C to stop.
`);

await rm(distDir, { recursive: true, force: true });
await copyExtFiles();

children.push(
  run("npx", ["vite", "build", "--watch"], "popup"),
  run(
    "npx",
    ["vite", "build", "--config", "vite.content.config.js", "--watch"],
    "content"
  )
);

watch(publicDir, { recursive: true }, scheduleCopy);
