import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, DEFAULT_THEME_TOKENS } from "../../src/storage/schema";
import { resolveTheme, validateTheme } from "../../src/sidepanel/theme";

describe("themes", () => {
  it("accepts the default accessible theme", () =>
    expect(validateTheme(DEFAULT_THEME_TOKENS).valid).toBe(true));
  it("rejects unreadable text", () =>
    expect(validateTheme({ ...DEFAULT_THEME_TOKENS, text: "#171714" }).valid).toBe(false));
  it("falls back safely when a custom theme is invalid", () => {
    expect(
      resolveTheme(
        {
          ...DEFAULT_SETTINGS.theme,
          preset: "custom",
          tokens: { ...DEFAULT_THEME_TOKENS, text: "#171714" },
        },
        [],
      ),
    ).toEqual(DEFAULT_THEME_TOKENS);
  });
});
