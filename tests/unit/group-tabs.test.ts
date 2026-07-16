import { describe, expect, it, vi } from "vitest";
import { findTabClusters, groupSuggestedTabs } from "../../src/background/group-tabs";
import { resetChrome } from "../../src/test/setup";

const tab = (id: number, url: string, patch: Partial<chrome.tabs.Tab> = {}) =>
  ({ id, url, windowId: 1, groupId: -1, ...patch }) as chrome.tabs.Tab;

describe("automatic tab grouping", () => {
  it("clusters ungrouped web tabs by normalized site", () => {
    expect(
      findTabClusters([
        tab(1, "https://canvas.example.edu/courses/1"),
        tab(2, "https://www.canvas.example.edu/calendar"),
        tab(3, "https://github.com/openai"),
      ]),
    ).toEqual([{ windowId: 1, domain: "canvas.example.edu", tabIds: [1, 2] }]);
  });

  it("does not alter existing groups, internal pages, or single tabs", () => {
    expect(
      findTabClusters([
        tab(1, "https://canvas.example.edu/one", { groupId: 9 }),
        tab(2, "https://canvas.example.edu/two", { groupId: 9 }),
        tab(3, "chrome://extensions"),
        tab(4, "https://only.example.com"),
      ]),
    ).toEqual([]);
  });

  it("re-checks suggested tabs before creating a named group", async () => {
    resetChrome();
    const get = chrome.tabs.get as unknown as ReturnType<typeof vi.fn>;
    get.mockResolvedValueOnce(tab(4, "https://jobs.example.com/one"));
    get.mockResolvedValueOnce(tab(5, "https://jobs.example.com/two"));
    (chrome.tabs.group as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(12);
    const result = await groupSuggestedTabs([4, 5], "Internship application");
    expect(result).toEqual({ ok: true, data: { tabs: 2, label: "Internship application" } });
    expect(chrome.tabGroups.update).toHaveBeenCalledWith(12, {
      title: "Internship application",
      color: "grey",
      collapsed: false,
    });
  });
});
