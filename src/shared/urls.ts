const INTERNAL_PROTOCOLS = new Set([
  "chrome:",
  "chrome-extension:",
  "edge:",
  "about:",
  "file:",
  "data:",
  "javascript:",
]);

export const getHostname = (value: string): string | null => {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname || null;
  } catch {
    return null;
  }
};

export const normalizeHostname = (hostname: string): string =>
  hostname.toLowerCase().replace(/^www\./, "");

export const normalizeUrl = (value: string): string | null => {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hostname = url.hostname.toLowerCase();
    return url.toString();
  } catch {
    return null;
  }
};

export const isInternalUrl = (value: string): boolean => {
  try {
    return INTERNAL_PROTOCOLS.has(new URL(value).protocol);
  } catch {
    return true;
  }
};

export const matchesDomain = (hostname: string, rule: string): boolean => {
  const candidate = normalizeHostname(hostname);
  const normalizedRule = normalizeHostname(rule.trim().replace(/^\./, ""));
  if (!normalizedRule) return false;
  return candidate === normalizedRule || candidate.endsWith(`.${normalizedRule}`);
};

export const canonicalDuplicateKey = (value: string): string | null => {
  const normalized = normalizeUrl(value);
  if (!normalized) return null;
  const url = new URL(normalized);
  url.hash = "";
  return url.toString();
};
