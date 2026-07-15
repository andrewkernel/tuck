import { describe, expect, it } from "vitest";
import { duplicateLosers } from "../../src/background/cleanup";

const tab = (id: number, patch: Partial<chrome.tabs.Tab> = {}) =>
  ({
    id,
    url: "https://example.com/report#one",
    active: false,
    pinned: false,
    lastAccessed: 1_000 + id,
    ...patch,
  }) as chrome.tabs.Tab;

describe("duplicate selection", () => {
  it("keeps the active tab before all other duplicates", () => {
    expect([...duplicateLosers([tab(1), tab(2, { active: true }), tab(3)])].sort()).toEqual([1, 3]);
  });

  it("keeps a pinned tab, then the most recently accessed tab", () => {
    expect([
      ...duplicateLosers([tab(1, { pinned: true }), tab(2, { lastAccessed: 9_000 })]),
    ]).toEqual([2]);
    expect([...duplicateLosers([tab(1), tab(2, { lastAccessed: 9_000 })])]).toEqual([1]);
  });
});
