import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = resolve(root, "public/manifest.json");
const outPath = resolve(root, "dist/manifest.json");

function readGoogleClientIdFromEnvFile() {
  try {
    const envPath = resolve(root, ".env");
    const text = readFileSync(envPath, "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = trimmed.match(/^VITE_GOOGLE_CLIENT_ID=(.*)$/);
      if (match) {
        return match[1].trim().replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    /* no .env */
  }
  return "";
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const clientId =
  process.env.VITE_GOOGLE_CLIENT_ID?.trim() || readGoogleClientIdFromEnvFile();

if (clientId) {
  manifest.oauth2 = {
    client_id: clientId,
    scopes: ["openid", "email", "profile"],
  };
} else {
  delete manifest.oauth2;
}

writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`);
if (clientId) {
  console.log("[syncle] manifest: oauth2 client_id injected (Google one-click sign-in enabled)");
} else {
  console.warn(
    "[syncle] manifest: VITE_GOOGLE_CLIENT_ID not set — Sign in with Google disabled. See .env.example"
  );
}
