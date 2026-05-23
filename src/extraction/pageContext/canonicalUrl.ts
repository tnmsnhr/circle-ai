/** Tracking/query params stripped when building canonical URL. */
const TRACKING_PREFIXES = ["utm_", "fbclid", "gclid", "mc_eid", "ref", "igshid"];

export interface PageIdentity {
  canonicalUrl: string;
  pageFingerprint: string;
}

function stripTrackingParams(url: URL): void {
  const toDelete: string[] = [];
  url.searchParams.forEach((_v, key) => {
    const lower = key.toLowerCase();
    if (TRACKING_PREFIXES.some((p) => lower === p || lower.startsWith(p))) {
      toDelete.push(key);
    }
  });
  for (const key of toDelete) url.searchParams.delete(key);

  const sorted = [...url.searchParams.entries()].sort(([a], [b]) =>
    a.localeCompare(b)
  );
  url.search = "";
  for (const [k, v] of sorted) url.searchParams.append(k, v);
}

function normalizePathname(pathname: string): string {
  let p = pathname.replace(/\/{2,}/g, "/");
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return p;
}

export function buildCanonicalUrl(href: string = location.href): string {
  const url = new URL(href);
  url.hash = "";
  stripTrackingParams(url);
  url.pathname = normalizePathname(url.pathname);
  return url.toString();
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function truncate(s: string, max: number): string {
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

/**
 * Stable page identity: canonical URL + hashed content hints (title, h1, meta).
 */
export async function getPageIdentity(
  doc: Document = document,
  href: string = location.href
): Promise<PageIdentity> {
  const canonicalUrl = buildCanonicalUrl(href);
  const title = truncate(doc.title || "", 200);
  const h1 =
    truncate(doc.querySelector("h1")?.textContent || "", 200) || "";
  const metaDescription =
    truncate(
      doc.querySelector('meta[name="description"]')?.getAttribute("content") ||
        doc.querySelector('meta[property="og:description"]')?.getAttribute(
          "content"
        ) ||
        "",
      300
    ) || "";

  const fingerprintInput = [canonicalUrl, title, h1, metaDescription].join("|");
  const pageFingerprint = await sha256Hex(fingerprintInput);

  return { canonicalUrl, pageFingerprint };
}
