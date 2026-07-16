import { describe, expect, it } from "vitest";
import { parseImport } from "../../src/storage/export-import";
import { createDefaultRoot } from "../../src/storage/schema";

describe("storage validation", () => {
  it("accepts a complete exported root", () =>
    expect(parseImport(JSON.stringify(createDefaultRoot())).ok).toBe(true));
  it("rejects malformed imported data", () => {
    expect(parseImport('{"version":999}')).toEqual(expect.objectContaining({ ok: false }));
  });
  it("rejects invalid JSON", () => {
    expect(parseImport("not json")).toEqual(expect.objectContaining({ ok: false }));
  });
  it("migrates older local data after removing Tuck Sense", () => {
    const legacy = createDefaultRoot() as unknown as Record<string, unknown>;
    legacy.version = 3;
    legacy.tuckSense = { enabled: true, feedback: [] };
    const result = parseImport(JSON.stringify(legacy));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.version).toBe(4);
      expect("tuckSense" in result.data).toBe(false);
    }
  });
  it("migrates version 1 local data without adding AI state", () => {
    const legacy = createDefaultRoot() as unknown as Record<string, unknown>;
    legacy.version = 1;
    const result = parseImport(JSON.stringify(legacy));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.version).toBe(4);
      expect("tuckSense" in result.data).toBe(false);
    }
  });
});
