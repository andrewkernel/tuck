import type { CustomTheme, ThemePreferences, ThemeTokens } from "../domain/types";
import { DEFAULT_THEME_TOKENS } from "../storage/schema";

export const THEME_PRESETS: Record<Exclude<ThemePreferences["preset"], "custom">, ThemeTokens> = {
  obsidian: DEFAULT_THEME_TOKENS,
  terminal: {
    background: "#07100a",
    surface: "#0c170f",
    surfaceHover: "#122219",
    border: "#23402d",
    borderStrong: "#315a3d",
    text: "#d8ffe2",
    textMuted: "#87b895",
    accent: "#54e37b",
    accentHover: "#78ef96",
    danger: "#ff7777",
    focus: "#8cffaa",
  },
  arctic: {
    background: "#111820",
    surface: "#17212b",
    surfaceHover: "#1e2c38",
    border: "#304150",
    borderStrong: "#42586a",
    text: "#eef8ff",
    textMuted: "#9bb1c3",
    accent: "#79c9ff",
    accentHover: "#9bd7ff",
    danger: "#ff8585",
    focus: "#a7ddff",
  },
  sunset: {
    background: "#211411",
    surface: "#2a1a16",
    surfaceHover: "#38231d",
    border: "#51342b",
    borderStrong: "#71483b",
    text: "#fff0e9",
    textMuted: "#c5a093",
    accent: "#ff9071",
    accentHover: "#ffa38a",
    danger: "#ff7373",
    focus: "#ffc0a7",
  },
  sakura: {
    background: "#181316",
    surface: "#21191e",
    surfaceHover: "#2d2229",
    border: "#46343f",
    borderStrong: "#644b5a",
    text: "#fff1f7",
    textMuted: "#c1a0b0",
    accent: "#f195bd",
    accentHover: "#f6afd0",
    danger: "#ff7777",
    focus: "#ffc3dd",
  },
  paper: {
    background: "#f5f3ed",
    surface: "#fbfaf6",
    surfaceHover: "#efede5",
    border: "#d8d4c9",
    borderStrong: "#bdb7aa",
    text: "#24231f",
    textMuted: "#706d64",
    accent: "#756421",
    accentHover: "#5f511a",
    danger: "#a33e37",
    focus: "#8d792b",
  },
  system: DEFAULT_THEME_TOKENS,
};

const toRgb = (hex: string) =>
  [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
const luminance = (hex: string): number =>
  toRgb(hex)
    .map((part) => (part <= 0.03928 ? part / 12.92 : ((part + 0.055) / 1.055) ** 2.4))
    .reduce((total, part, index) => total + part * [0.2126, 0.7152, 0.0722][index], 0);
export const contrastRatio = (foreground: string, background: string): number => {
  const [a, b] = [luminance(foreground), luminance(background)].sort((left, right) => right - left);
  return (a + 0.05) / (b + 0.05);
};

export const validateTheme = (
  tokens: ThemeTokens,
): { valid: boolean; contrast: number; warning?: string } => {
  const contrast = contrastRatio(tokens.text, tokens.background);
  const focusContrast = contrastRatio(tokens.focus, tokens.background);
  if (contrast < 4.5)
    return {
      valid: false,
      contrast,
      warning: "Text needs at least 4.5:1 contrast against the background.",
    };
  if (focusContrast < 3)
    return {
      valid: false,
      contrast,
      warning: "The focus color needs at least 3:1 contrast against the background.",
    };
  return { valid: true, contrast };
};

export const resolveTheme = (
  preferences: ThemePreferences,
  customThemes: CustomTheme[],
): ThemeTokens => {
  const custom = preferences.customThemeId
    ? customThemes.find((item) => item.id === preferences.customThemeId)
    : undefined;
  const candidate =
    preferences.tokens ??
    (preferences.preset === "custom" ? custom?.tokens : THEME_PRESETS[preferences.preset]);
  if (!candidate || !validateTheme(candidate).valid) return DEFAULT_THEME_TOKENS;
  return candidate;
};

export const applyTheme = (tokens: ThemeTokens, preferences: ThemePreferences): void => {
  const root = document.documentElement;
  for (const [name, value] of Object.entries(tokens))
    root.style.setProperty(
      `--${name.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)}`,
      value,
    );
  root.dataset.density = preferences.density;
  root.dataset.radius = preferences.radius;
  root.dataset.font = preferences.font;
  root.dataset.favicons = String(preferences.showFavicons);
  root.style.colorScheme = preferences.preset === "paper" ? "light" : "dark";
};
