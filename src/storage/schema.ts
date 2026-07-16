import { z } from "zod";
import type { ExtensionSettings, StorageRoot, ThemeTokens, TuckSenseState } from "../domain/types";

export const STORAGE_VERSION = 3;

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a six-digit hex color.");
export const themeTokensSchema = z.object({
  background: color,
  surface: color,
  surfaceHover: color,
  border: color,
  borderStrong: color,
  text: color,
  textMuted: color,
  accent: color,
  accentHover: color,
  danger: color,
  focus: color,
});

const archivedTabSchema = z.object({
  id: z.string().min(1),
  url: z.string().url(),
  title: z.string(),
  domain: z.string(),
  faviconUrl: z.string().url().optional(),
  lastAccessedAt: z.number().finite().nonnegative(),
  archivedAt: z.number().finite().nonnegative(),
  sourceWindowId: z.number().int().optional(),
  note: z.string().optional(),
  tags: z.array(z.string()),
  protected: z.boolean(),
  archiveReason: z.enum(["inactive", "manual", "duplicate"]),
});

const noteSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(160),
  value: z.string().min(1).max(20_000),
  kind: z.enum(["text", "url", "email", "profile", "project", "resume", "form"]),
  primaryAction: z.enum(["copy", "open", "edit"]),
  openTarget: z.enum(["current-tab", "new-tab"]),
  domains: z.array(z.string()),
  tags: z.array(z.string()),
  createdAt: z.number().finite().nonnegative(),
  updatedAt: z.number().finite().nonnegative(),
  copyCount: z.number().int().nonnegative(),
  pinned: z.boolean(),
});

const protectedTabSchema = z.object({
  tabId: z.number().int().nonnegative(),
  expiresAt: z.number().finite().positive().optional(),
  createdAt: z.number().finite().nonnegative(),
});

const themePreferencesSchema = z.object({
  preset: z.enum([
    "system",
    "obsidian",
    "terminal",
    "arctic",
    "sunset",
    "sakura",
    "paper",
    "custom",
  ]),
  customThemeId: z.string().optional(),
  tokens: themeTokensSchema.optional(),
  density: z.enum(["compact", "comfortable", "spacious"]),
  radius: z.enum(["square", "subtle", "rounded"]),
  font: z.enum(["sans", "mono"]),
  showFavicons: z.boolean(),
});

const settingsSchema = z
  .object({
    cleanupEnabled: z.boolean(),
    discardAfterMinutes: z.number().int().min(5).max(43_200),
    archiveAfterMinutes: z.number().int().min(15).max(129_600),
    cleanupIntervalMinutes: z.number().int().min(5).max(1_440),
    includeAllWindows: z.boolean(),
    closeDuplicates: z.boolean(),
    ignoreIncognito: z.boolean(),
    protectPinned: z.boolean(),
    protectAudible: z.boolean(),
    protectedDomains: z.array(z.string().min(1).max(253)).max(200),
    theme: themePreferencesSchema,
    customThemes: z
      .array(
        z.object({
          id: z.string(),
          name: z.string().min(1).max(80),
          tokens: themeTokensSchema,
          createdAt: z.number(),
          updatedAt: z.number(),
        }),
      )
      .max(50),
  })
  .superRefine((settings, ctx) => {
    if (settings.archiveAfterMinutes < settings.discardAfterMinutes) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Archive threshold must be at least the discard threshold.",
        path: ["archiveAfterMinutes"],
      });
    }
  });

const cleanupLogSchema = z.object({
  id: z.string(),
  at: z.number(),
  action: z.enum(["discarded", "archived", "skipped", "error"]),
  tabId: z.number().int().optional(),
  title: z.string().optional(),
  detail: z.string(),
});

const tuckSenseStateSchema = z.object({
  enabled: z.boolean(),
  lastAnalysis: z
    .object({
      generatedAt: z.number().finite().nonnegative(),
      summary: z.string().min(1).max(400),
      groups: z
        .array(
          z.object({
            label: z.string().min(1).max(48),
            reason: z.string().min(1).max(240),
            tabIds: z.array(z.number().int().nonnegative()).min(2).max(12),
          }),
        )
        .max(8),
      archiveSuggestions: z
        .array(
          z.object({
            tabId: z.number().int().nonnegative(),
            title: z.string().min(1).max(300),
            domain: z.string().min(1).max(253),
            kind: z.enum(["duplicate", "stale"]),
            reason: z.string().min(1).max(240),
          }),
        )
        .max(20),
    })
    .optional(),
  feedback: z
    .array(
      z.object({
        query: z.string().min(1).max(500),
        tabId: z.number().int().nonnegative(),
        relevance: z.enum(["relevant", "not-relevant"]),
        updatedAt: z.number().finite().nonnegative(),
      }),
    )
    .max(200),
});

export const storageRootSchema = z.object({
  version: z.literal(STORAGE_VERSION),
  archivedTabs: z.array(archivedTabSchema).max(5_000),
  notes: z.array(noteSchema).max(5_000),
  protectedTabs: z.array(protectedTabSchema).max(5_000),
  settings: settingsSchema,
  cleanupLog: z.array(cleanupLogSchema).max(100),
  tuckSense: tuckSenseStateSchema,
});

export const DEFAULT_THEME_TOKENS: ThemeTokens = {
  background: "#171714",
  surface: "#1d1d19",
  surfaceHover: "#24241f",
  border: "#34342e",
  borderStrong: "#49483f",
  text: "#f0efe8",
  textMuted: "#a6a398",
  accent: "#c8b66a",
  accentHover: "#d3c37c",
  danger: "#d16f67",
  focus: "#d7c982",
};

export const DEFAULT_SETTINGS: ExtensionSettings = {
  cleanupEnabled: true,
  discardAfterMinutes: 60,
  archiveAfterMinutes: 24 * 60,
  cleanupIntervalMinutes: 15,
  includeAllWindows: false,
  closeDuplicates: false,
  ignoreIncognito: true,
  protectPinned: true,
  protectAudible: true,
  protectedDomains: [],
  theme: {
    preset: "obsidian",
    density: "comfortable",
    radius: "subtle",
    font: "sans",
    showFavicons: true,
  },
  customThemes: [],
};

export const DEFAULT_TUCK_SENSE: TuckSenseState = { enabled: false, feedback: [] };

export const createDefaultRoot = (): StorageRoot => ({
  version: STORAGE_VERSION,
  archivedTabs: [],
  notes: [],
  protectedTabs: [],
  settings: structuredClone(DEFAULT_SETTINGS),
  cleanupLog: [],
  tuckSense: structuredClone(DEFAULT_TUCK_SENSE),
});
