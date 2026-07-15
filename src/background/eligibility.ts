import type { ExtensionSettings, ProtectedTab } from "../domain/types";
import { getHostname, isInternalUrl, matchesDomain, normalizeUrl } from "../shared/urls";

export type ProtectionReason =
  | "active"
  | "pinned"
  | "audible"
  | "protected-tab"
  | "protected-domain"
  | "internal-url"
  | "recently-opened"
  | "missing-url"
  | "incognito"
  | "user-excluded"
  | "processing";
export type EligibilityResult = { eligible: true } | { eligible: false; reason: ProtectionReason };

export const isProtectedTab = (
  tabId: number | undefined,
  protectedTabs: ProtectedTab[],
  now = Date.now(),
): boolean =>
  tabId !== undefined &&
  protectedTabs.some((item) => item.tabId === tabId && (!item.expiresAt || item.expiresAt > now));

export const getEligibility = (
  tab: chrome.tabs.Tab,
  settings: ExtensionSettings,
  protectedTabs: ProtectedTab[],
  thresholdMinutes: number,
  processing = new Set<number>(),
  now = Date.now(),
): EligibilityResult => {
  if (tab.id === undefined) return { eligible: false, reason: "missing-url" };
  if (processing.has(tab.id)) return { eligible: false, reason: "processing" };
  if (tab.active) return { eligible: false, reason: "active" };
  if (settings.protectPinned && tab.pinned) return { eligible: false, reason: "pinned" };
  if (settings.protectAudible && tab.audible) return { eligible: false, reason: "audible" };
  if (settings.ignoreIncognito && tab.incognito) return { eligible: false, reason: "incognito" };
  if (isProtectedTab(tab.id, protectedTabs, now))
    return { eligible: false, reason: "protected-tab" };
  if (!tab.url || !normalizeUrl(tab.url)) return { eligible: false, reason: "missing-url" };
  if (isInternalUrl(tab.url)) return { eligible: false, reason: "internal-url" };
  const hostname = getHostname(tab.url);
  if (!hostname || settings.protectedDomains.some((rule) => matchesDomain(hostname, rule)))
    return { eligible: false, reason: "protected-domain" };
  if (!tab.lastAccessed || now - tab.lastAccessed < thresholdMinutes * 60_000)
    return { eligible: false, reason: "recently-opened" };
  return { eligible: true };
};
