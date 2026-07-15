import type { Result } from "../domain/types";
import { getHostname, normalizeHostname, normalizeUrl } from "../shared/urls";

export type TabCluster = { windowId: number; domain: string; tabIds: number[] };
export type GroupTabsSummary = { groups: number; tabs: number; errors: string[] };

export const findTabClusters = (tabs: chrome.tabs.Tab[]): TabCluster[] => {
  const clusters = new Map<string, TabCluster>();
  for (const tab of tabs) {
    if (tab.id === undefined || tab.windowId === undefined || !tab.url || !normalizeUrl(tab.url))
      continue;
    if (tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) continue;
    const hostname = getHostname(tab.url);
    if (!hostname) continue;
    const domain = normalizeHostname(hostname);
    const key = `${tab.windowId}:${domain}`;
    const cluster = clusters.get(key) ?? { windowId: tab.windowId, domain, tabIds: [] };
    cluster.tabIds.push(tab.id);
    clusters.set(key, cluster);
  }
  return [...clusters.values()].filter((cluster) => cluster.tabIds.length >= 2);
};

export const groupRelatedTabs = async (
  includeAllWindows: boolean,
): Promise<Result<GroupTabsSummary>> => {
  try {
    const tabs = await chrome.tabs.query(includeAllWindows ? {} : { currentWindow: true });
    const clusters = findTabClusters(tabs);
    const summary: GroupTabsSummary = { groups: 0, tabs: 0, errors: [] };
    for (const cluster of clusters) {
      try {
        const groupId = await chrome.tabs.group({
          tabIds: cluster.tabIds as [number, ...number[]],
          createProperties: { windowId: cluster.windowId },
        });
        await chrome.tabGroups.update(groupId, { title: "Tuck", color: "grey", collapsed: false });
        summary.groups += 1;
        summary.tabs += cluster.tabIds.length;
      } catch {
        summary.errors.push(`Could not group ${cluster.domain}.`);
      }
    }
    return { ok: true, data: summary };
  } catch {
    return {
      ok: false,
      error: { code: "UNKNOWN", message: "TabShelf could not organize these tabs." },
    };
  }
};
