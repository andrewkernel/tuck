import { describe, expect, it } from "vitest";
import { findTabClusters } from "../../src/background/group-tabs";

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
});
