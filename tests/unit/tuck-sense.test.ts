import { describe, expect, it } from "vitest";
import { validateTuckSenseAnalysis } from "../../src/tuck-sense/engine";
import type { TuckSenseTabContext } from "../../src/domain/types";

const tabs: TuckSenseTabContext[] = [
  {
    id: 1,
    windowId: 5,
    title: "Internship application tracker",
    url: "https://jobs.example.com/tracker",
    domain: "jobs.example.com",
    unusedMinutes: 300,
    archiveEligible: true,
  },
  {
    id: 2,
    windowId: 5,
    title: "Resume notes",
    url: "https://docs.example.com/resume",
    domain: "docs.example.com",
    unusedMinutes: 120,
    archiveEligible: false,
  },
  {
    id: 3,
    windowId: 8,
    title: "Another window",
    url: "https://example.com/other",
    domain: "example.com",
    unusedMinutes: 500,
    archiveEligible: true,
  },
];

describe("Tuck Sense response validation", () => {
  it("keeps only same-window groups and archive-safe suggestions", () => {
    const result = validateTuckSenseAnalysis(
      {
        summary: "Two application tabs can be reviewed together.",
        groups: [
          { label: "Applications", reason: "Both support the same application.", tabIds: [1, 2] },
          { label: "Invalid", reason: "Different windows.", tabIds: [1, 3] },
        ],
        archiveSuggestions: [
          { tabId: 1, kind: "stale", reason: "Unused for several hours." },
          { tabId: 2, kind: "duplicate", reason: "Looks duplicated." },
        ],
      },
      tabs,
    );

    expect(result.groups).toEqual([
      expect.objectContaining({ label: "Applications", tabIds: [1, 2] }),
    ]);
    expect(result.archiveSuggestions).toEqual([
      expect.objectContaining({ tabId: 1, title: "Internship application tracker" }),
    ]);
  });

  it("rejects malformed model output instead of trusting it", () => {
    const malformed = {
      summary: "Bad response",
      groups: [],
      archiveSuggestions: [],
      ignored: "not allowed",
    };
    expect(() => validateTuckSenseAnalysis(malformed, tabs)).toThrow();
  });
});
