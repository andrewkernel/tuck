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
});
