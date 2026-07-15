import type { ArchivedTab, CleanupLogEntry, Result } from "../domain/types";
import { createId } from "../shared/ids";
import { canonicalDuplicateKey, getHostname, normalizeUrl } from "../shared/urls";
import { repository } from "../storage/repository";
import { getEligibility } from "./eligibility";

const processing = new Set<number>();
let cleanupRunning = false;
const MAX_ARCHIVES_PER_RUN = 25;

export type CleanupSummary = {
  discarded: number;
  archived: number;
  skipped: number;
  errors: string[];
};
const emptySummary = (): CleanupSummary => ({ discarded: 0, archived: 0, skipped: 0, errors: [] });

export const duplicateLosers = (tabs: chrome.tabs.Tab[]): Set<number> => {
  const groups = new Map<string, chrome.tabs.Tab[]>();
  for (const tab of tabs) {
    if (tab.id === undefined || !tab.url) continue;
    const key = canonicalDuplicateKey(tab.url);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), tab]);
  }
  const losers = new Set<number>();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const [, ...duplicates] = group.slice().sort((left, right) => {
      if (left.active !== right.active) return Number(right.active) - Number(left.active);
      if (left.pinned !== right.pinned) return Number(right.pinned) - Number(left.pinned);
      const accessOrder = (right.lastAccessed ?? 0) - (left.lastAccessed ?? 0);
      return accessOrder || left.id! - right.id!;
    });
    for (const tab of duplicates) if (tab.id !== undefined) losers.add(tab.id);
  }
  return losers;
};

const archiveFromTab = (
  tab: chrome.tabs.Tab,
  reason: ArchivedTab["archiveReason"],
): ArchivedTab | null => {
  if (tab.id === undefined || !tab.url) return null;
  const url = normalizeUrl(tab.url);
  const domain = getHostname(tab.url);
  if (!url || !domain) return null;
  return {
    id: createId(),
    url,
    title: tab.title?.trim() || domain,
    domain,
    faviconUrl: tab.favIconUrl,
    lastAccessedAt: tab.lastAccessed ?? Date.now(),
    archivedAt: Date.now(),
    sourceWindowId: tab.windowId,
    tags: [],
    protected: false,
    archiveReason: reason,
  };
};

const log = (entry: Omit<CleanupLogEntry, "id" | "at">) => repository.addLog(entry);

export async function archiveAndCloseTab(
  tabId: number,
  reason: ArchivedTab["archiveReason"] = "manual",
): Promise<Result<ArchivedTab>> {
  if (processing.has(tabId))
    return {
      ok: false,
      error: { code: "TAB_INELIGIBLE", message: "This tab is already being processed." },
    };
  processing.add(tabId);
  try {
    const rootResult = await repository.getRoot();
    if (!rootResult.ok) return rootResult;
    let tab: chrome.tabs.Tab;
    try {
      tab = await chrome.tabs.get(tabId);
    } catch {
      return {
        ok: false,
        error: { code: "TAB_NOT_FOUND", message: "This tab is no longer open." },
      };
    }
    const eligibility = getEligibility(
      tab,
      rootResult.data.settings,
      rootResult.data.protectedTabs,
      0,
      new Set(),
    );
    if (!eligibility.eligible)
      return {
        ok: false,
        error: {
          code: "TAB_INELIGIBLE",
          message: `This tab cannot be archived because it is ${eligibility.reason.replace(/-/g, " ")}.`,
        },
      };
    const archive = archiveFromTab(tab, reason);
    if (!archive)
      return {
        ok: false,
        error: { code: "INVALID_URL", message: "This tab does not have a restorable web address." },
      };
    const saved = await repository.addArchive(archive);
    if (!saved.ok) return saved;
    try {
      await chrome.tabs.remove(tabId);
      await log({
        action: "archived",
        tabId,
        title: archive.title,
        detail: "Archived before closing.",
      });
      return { ok: true, data: archive };
    } catch {
      await log({
        action: "error",
        tabId,
        title: archive.title,
        detail: "Archive was saved, but Chrome could not close the tab.",
      });
      return {
        ok: false,
        error: {
          code: "TAB_CLOSE_FAILED",
          message:
            "The archive was saved, but Chrome could not close this tab. You can close it manually.",
        },
      };
    }
  } finally {
    processing.delete(tabId);
  }
}

export async function runCleanup(): Promise<Result<CleanupSummary>> {
  if (cleanupRunning)
    return { ok: false, error: { code: "TAB_INELIGIBLE", message: "Cleanup is already running." } };
  cleanupRunning = true;
  const summary = emptySummary();
  try {
    const rootResult = await repository.getRoot();
    if (!rootResult.ok) return rootResult;
    const { settings, protectedTabs } = rootResult.data;
    if (!settings.cleanupEnabled) return { ok: true, data: summary };
    const query: chrome.tabs.QueryInfo = settings.includeAllWindows ? {} : { currentWindow: true };
    const tabs = (await chrome.tabs.query(query)).sort(
      (left, right) => (left.lastAccessed ?? Infinity) - (right.lastAccessed ?? Infinity),
    );
    const duplicates = settings.closeDuplicates ? duplicateLosers(tabs) : new Set<number>();
    for (const listed of tabs) {
      if (listed.id === undefined || listed.discarded) continue;
      let tab: chrome.tabs.Tab;
      try {
        tab = await chrome.tabs.get(listed.id);
      } catch {
        continue;
      }
      const eligible = getEligibility(
        tab,
        settings,
        protectedTabs,
        settings.discardAfterMinutes,
        processing,
      );
      if (!eligible.eligible) continue;
      try {
        await chrome.tabs.discard(tab.id);
        summary.discarded += 1;
        await log({
          action: "discarded",
          tabId: tab.id,
          title: tab.title,
          detail: "Inactive tab discarded.",
        });
      } catch {
        summary.errors.push(`Could not discard ${tab.title ?? "a tab"}.`);
      }
    }
    let archives = 0;
    for (const listed of tabs) {
      if (archives >= MAX_ARCHIVES_PER_RUN || listed.id === undefined) break;
      let tab: chrome.tabs.Tab;
      try {
        tab = await chrome.tabs.get(listed.id);
      } catch {
        continue;
      }
      const eligible = getEligibility(
        tab,
        settings,
        protectedTabs,
        settings.archiveAfterMinutes,
        processing,
      );
      if (!eligible.eligible) {
        if (
          ["pinned", "audible", "active", "protected-domain", "protected-tab"].includes(
            eligible.reason,
          )
        )
          summary.skipped += 1;
        continue;
      }
      if (tab.id === undefined) continue;
      const archived = await archiveAndCloseTab(
        tab.id,
        duplicates.has(tab.id) ? "duplicate" : "inactive",
      );
      if (archived.ok) {
        archives += 1;
        summary.archived += 1;
      } else {
        summary.errors.push(archived.error.message);
      }
    }
    return { ok: true, data: summary };
  } catch {
    return {
      ok: false,
      error: {
        code: "UNKNOWN",
        message: "Cleanup could not finish. No tab was closed without first being archived.",
      },
    };
  } finally {
    cleanupRunning = false;
  }
}
