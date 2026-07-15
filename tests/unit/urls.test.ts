import { describe, expect, it } from "vitest";
import {
  canonicalDuplicateKey,
  getHostname,
  isInternalUrl,
  matchesDomain,
  normalizeUrl,
} from "../../src/shared/urls";

describe("URL helpers", () => {
  it("normalizes web URLs but preserves useful restoration paths", () => {
    expect(normalizeUrl("HTTPS://WWW.Example.COM/jobs?a=1#section")).toBe(
      "https://www.example.com/jobs?a=1#section",
    );
    expect(normalizeUrl("chrome://settings")).toBeNull();
  });
  it("detects internal and malformed URLs", () => {
    expect(isInternalUrl("chrome://extensions")).toBe(true);
    expect(isInternalUrl("not-a-url")).toBe(true);
    expect(isInternalUrl("https://example.com")).toBe(false);
  });
  it("matches domains at proper boundaries", () => {
    expect(matchesDomain("www.linkedin.com", "linkedin.com")).toBe(true);
    expect(matchesDomain("jobs.linkedin.com", "linkedin.com")).toBe(true);
    expect(matchesDomain("notlinkedin.com", "linkedin.com")).toBe(false);
    expect(getHostname("https://Example.com/x")).toBe("example.com");
  });
  it("uses fragment-free duplicate keys", () => {
    expect(canonicalDuplicateKey("https://example.com/a#one")).toBe(
      canonicalDuplicateKey("https://example.com/a#two"),
    );
  });
});
