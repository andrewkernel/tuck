import { describe, expect, it, vi } from "vitest";
import { archiveAndCloseTab } from "../../src/background/cleanup";
import { resetChrome } from "../../src/test/setup";

const staleTab = {
  id: 19,
  url: "https://example.com/report",
  title: "Report",
  active: false,
  pinned: false,
  audible: false,
  incognito: false,
  lastAccessed: Date.now() - 86_400_000,
  windowId: 3,
} as chrome.tabs.Tab;

describe("archive-before-close safety", () => {
  it("persists an archive before asking Chrome to close a tab", async () => {
    resetChrome();
    const order: string[] = [];
    const persist = (
      chrome.storage.local.set as unknown as {
        getMockImplementation: () => (value: Record<string, unknown>) => Promise<void>;
      }
    ).getMockImplementation();
    (chrome.storage.local.set as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async (value: Record<string, unknown>) => {
        order.push("save");
        await persist(value);
      },
    );
    (chrome.tabs.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(staleTab);
    (chrome.tabs.remove as unknown as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      order.push("remove");
    });
    const result = await archiveAndCloseTab(19);
    expect(result.ok).toBe(true);
    expect(order).toEqual(["save", "remove", "save"]);
  });
  it("does not close when archive persistence fails", async () => {
    resetChrome();
    (chrome.tabs.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(staleTab);
    (chrome.storage.local.set as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("quota"),
    );
    const result = await archiveAndCloseTab(19);
    expect(result.ok).toBe(false);
    expect(chrome.tabs.remove).not.toHaveBeenCalled();
  });
});
