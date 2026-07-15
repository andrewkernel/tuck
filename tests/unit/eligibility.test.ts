import { describe, expect, it } from "vitest";
import { getEligibility } from "../../src/background/eligibility";
import { DEFAULT_SETTINGS } from "../../src/storage/schema";

const now = 1_000_000_000;
const baseTab = {
  id: 7,
  url: "https://example.com/work",
  active: false,
  pinned: false,
  audible: false,
  incognito: false,
  lastAccessed: now - 120 * 60_000,
} as chrome.tabs.Tab;

describe("tab eligibility", () => {
  it.each([
    [{ active: true }, "active"],
    [{ pinned: true }, "pinned"],
    [{ audible: true }, "audible"],
    [{ url: "chrome://settings" }, "missing-url"],
    [{ incognito: true }, "incognito"],
  ] as const)("protects %o", (patch, reason) => {
    expect(
      getEligibility({ ...baseTab, ...patch }, DEFAULT_SETTINGS, [], 60, new Set(), now),
    ).toEqual({ eligible: false, reason });
  });
  it("honors domain, manual, and age protection", () => {
    expect(
      getEligibility(
        baseTab,
        { ...DEFAULT_SETTINGS, protectedDomains: ["example.com"] },
        [],
        60,
        new Set(),
        now,
      ),
    ).toEqual({ eligible: false, reason: "protected-domain" });
    expect(
      getEligibility(baseTab, DEFAULT_SETTINGS, [{ tabId: 7, createdAt: now }], 60, new Set(), now),
    ).toEqual({ eligible: false, reason: "protected-tab" });
    expect(
      getEligibility(
        { ...baseTab, lastAccessed: now - 5 * 60_000 },
        DEFAULT_SETTINGS,
        [],
        60,
        new Set(),
        now,
      ),
    ).toEqual({ eligible: false, reason: "recently-opened" });
  });
  it("returns eligible only after all safety checks pass", () => {
    expect(getEligibility(baseTab, DEFAULT_SETTINGS, [], 60, new Set(), now)).toEqual({
      eligible: true,
    });
  });
});
