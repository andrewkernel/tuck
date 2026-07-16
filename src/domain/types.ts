export type ArchiveReason = "inactive" | "manual" | "duplicate";
export type SavedItemKind = "text" | "url" | "email" | "profile" | "project" | "resume" | "form";
export type SavedItemPrimaryAction = "copy" | "open" | "edit";
export type OpenTarget = "current-tab" | "new-tab";
export type ThemePresetId =
  "system" | "obsidian" | "terminal" | "arctic" | "sunset" | "sakura" | "paper" | "custom";

export type ArchivedTab = {
  id: string;
  url: string;
  title: string;
  domain: string;
  faviconUrl?: string;
  lastAccessedAt: number;
  archivedAt: number;
  sourceWindowId?: number;
  note?: string;
  tags: string[];
  protected: boolean;
  archiveReason: ArchiveReason;
};

export type SavedNote = {
  id: string;
  title: string;
  value: string;
  kind: SavedItemKind;
  primaryAction: SavedItemPrimaryAction;
  openTarget: OpenTarget;
  domains: string[];
  tags: string[];
  createdAt: number;
  updatedAt: number;
  copyCount: number;
  pinned: boolean;
};

export type ProtectedTab = { tabId: number; expiresAt?: number; createdAt: number };

export type ThemeTokens = {
  background: string;
  surface: string;
  surfaceHover: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  accent: string;
  accentHover: string;
  danger: string;
  focus: string;
};

export type CustomTheme = {
  id: string;
  name: string;
  tokens: ThemeTokens;
  createdAt: number;
  updatedAt: number;
};

export type ThemePreferences = {
  preset: ThemePresetId;
  customThemeId?: string;
  tokens?: ThemeTokens;
  density: "compact" | "comfortable" | "spacious";
  radius: "square" | "subtle" | "rounded";
  font: "sans" | "mono";
  showFavicons: boolean;
};

export type ExtensionSettings = {
  cleanupEnabled: boolean;
  discardAfterMinutes: number;
  archiveAfterMinutes: number;
  cleanupIntervalMinutes: number;
  includeAllWindows: boolean;
  closeDuplicates: boolean;
  ignoreIncognito: boolean;
  protectPinned: boolean;
  protectAudible: boolean;
  protectedDomains: string[];
  theme: ThemePreferences;
  customThemes: CustomTheme[];
};

export type CleanupLogEntry = {
  id: string;
  at: number;
  action: "discarded" | "archived" | "skipped" | "error";
  tabId?: number;
  title?: string;
  detail: string;
};

export type StorageRoot = {
  version: number;
  archivedTabs: ArchivedTab[];
  notes: SavedNote[];
  protectedTabs: ProtectedTab[];
  settings: ExtensionSettings;
  cleanupLog: CleanupLogEntry[];
};

export type TuckErrorCode =
  | "TAB_NOT_FOUND"
  | "TAB_INELIGIBLE"
  | "INVALID_URL"
  | "STORAGE_READ_FAILED"
  | "STORAGE_WRITE_FAILED"
  | "TAB_CLOSE_FAILED"
  | "TAB_RESTORE_FAILED"
  | "IMPORT_INVALID"
  | "UNKNOWN";

export type TuckError = { code: TuckErrorCode; message: string };
export type Result<T> = { ok: true; data: T } | { ok: false; error: TuckError };
