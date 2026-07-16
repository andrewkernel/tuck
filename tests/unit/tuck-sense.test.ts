import { describe, expect, it } from "vitest";
import {
  localSearchTuckSense,
  mergeTuckSenseSearchResults,
  normalizeTuckSenseQuery,
  validateTuckSenseAnalysis,
} from "../../src/tuck-sense/engine";
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

  it("finds literal title, URL, domain, and approved-note matches before reranking", () => {
    const matches = localSearchTuckSense("internship applications", tabs, [
      {
        id: "note-1",
        title: "Application follow-up",
        value: "Internship interview checklist",
        kind: "text",
        primaryAction: "copy",
        openTarget: "new-tab",
        domains: ["jobs.example.com"],
        tags: [],
        createdAt: 1,
        updatedAt: 1,
        copyCount: 0,
        pinned: false,
      },
    ]);
    expect(matches.map((match) => match.tab.id)).toEqual([1]);
    expect(matches[0]?.reason).toContain("internship");
  });

  it("keeps a local not-relevant decision out of future results for the same query", () => {
    const query = normalizeTuckSenseQuery("internship application");
    expect(
      localSearchTuckSense(
        "internship application",
        tabs,
        [],
        [{ query, tabId: 1, relevance: "not-relevant", updatedAt: 1 }],
      ),
    ).toEqual([]);
  });

  it("rejects unknown or duplicate model ids while preserving local candidates", () => {
    const local = localSearchTuckSense("internship application", tabs, []);
    const merged = mergeTuckSenseSearchResults(local, {
      orderedTabIds: [999, 1, 1],
      reasons: [
        { tabId: 999, reason: "Not a supplied tab." },
        { tabId: 1, reason: "Application tracker." },
      ],
    });
    expect(merged).toEqual([
      expect.objectContaining({
        tab: expect.objectContaining({ id: 1 }),
        reason: "Application tracker.",
      }),
    ]);
  });
});
