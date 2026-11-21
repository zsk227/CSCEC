import { identityKeyForUrl } from "../packages/backend/src/lib/url.ts";

// Verified official hosts whose archived URLs stopped working when www was removed.
const legacyWwwHosts = new Set([
  "cscec.com", "digitalchina.gov.cn", "hbqj.gov.cn", "nda.gov.cn",
  "ndrc.gov.cn", "nea.gov.cn", "tianmen.gov.cn", "wehdz.gov.cn",
]);

export function articleUrl(input: string, { legacy = false } = {}): string | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password) return null;
  if (legacy && legacyWwwHosts.has(url.hostname)) url.hostname = `www.${url.hostname}`;
  return url.href;
}

export function articleKey(url: string): string {
  return identityKeyForUrl(url, { keepFragment: new URL(url).hash.startsWith("#/") })!;
}
