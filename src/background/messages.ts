import type { ExtensionSettings, Result, SavedNote } from "../domain/types";
import { createId } from "../shared/ids";
import { getHostname, normalizeUrl } from "../shared/urls";
import { exportRoot, parseImport } from "../storage/export-import";
import { repository } from "../storage/repository";
import { archiveAndCloseTab, runCleanup } from "./cleanup";
import { groupRelatedTabs, groupSuggestedTabs } from "./group-tabs";
import { getEligibility } from "./eligibility";

export type OpenTabCandidate = {
  id: number;
  title: string;
  url: string;
  domain: string;
  faviconUrl?: string;
  unusedMinutes: number;
  protected: boolean;
};
export type ActiveContext = { hostname: string | null; tabId?: number };

export type ExtensionMessage =
  | { type: "GET_ROOT" }
  | { type: "GET_ACTIVE_CONTEXT" }
  | { type: "GET_OPEN_TABS" }
  | { type: "RUN_CLEANUP" }
  | { type: "AUTO_GROUP_TABS" }
  | { type: "GROUP_SUGGESTED_TABS"; tabIds: number[]; label: string }
  | { type: "ARCHIVE_TAB"; tabId: number }
  | { type: "PROTECT_TAB"; tabId: number; duration: "hour" | "day" | "forever" }
  | { type: "RESTORE_ARCHIVE"; archiveId: string; background?: boolean }
  | { type: "DELETE_ARCHIVE"; archiveId: string }
  | { type: "UPSERT_NOTE"; note: SavedNote }
  | { type: "DELETE_NOTE"; noteId: string }
  | { type: "COPY_NOTE"; noteId: string }
  | { type: "OPEN_NOTE"; noteId: string }
  | { type: "UPDATE_SETTINGS"; patch: Partial<ExtensionSettings> }
  | { type: "IMPORT_ROOT"; text: string }
  | { type: "EXPORT_ROOT" };

const failure = <T>(
  code: Result<T>["ok"] extends true
    ? never
    : "TAB_NOT_FOUND" | "INVALID_URL" | "TAB_RESTORE_FAILED" | "UNKNOWN",
  message: string,
): Result<T> => ({ ok: false, error: { code, message } });
const unknownMessage = (value: unknown): value is { type: string } =>
  typeof value === "object" &&
  value !== null &&
  "type" in value &&
  typeof (value as { type?: unknown }).type === "string";

const getActiveContext = async (): Promise<Result<ActiveContext>> => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return { ok: true, data: { hostname: tab?.url ? getHostname(tab.url) : null, tabId: tab?.id } };
  } catch {
    return failure("UNKNOWN", "Tuck could not read the active tab.");
  }
};

const getOpenTabs = async (): Promise<Result<OpenTabCandidate[]>> => {
  const root = await repository.getRoot();
  if (!root.ok) return root;
  try {
    const query: chrome.tabs.QueryInfo = root.data.settings.includeAllWindows
      ? {}
      : { currentWindow: true };
    const tabs = await chrome.tabs.query(query);
    const now = Date.now();
    const candidates = tabs.flatMap((tab): OpenTabCandidate[] => {
      if (tab.id === undefined || !tab.url) return [];
      const eligibility = getEligibility(
        tab,
        root.data.settings,
        root.data.protectedTabs,
        root.data.settings.discardAfterMinutes,
        new Set(),
        now,
      );
      const domain = getHostname(tab.url);
      if (!domain || (!eligibility.eligible && eligibility.reason !== "recently-opened")) return [];
      return [
        {
          id: tab.id,
          title: tab.title || domain,
          url: tab.url,
          domain,
          faviconUrl: tab.favIconUrl,
          unusedMinutes: Math.max(0, Math.floor((now - (tab.lastAccessed ?? now)) / 60_000)),
          protected: !eligibility.eligible,
        },
      ];
    });
    return {
      ok: true,
      data: candidates.sort((left, right) => right.unusedMinutes - left.unusedMinutes),
    };
  } catch {
    return failure("UNKNOWN", "Tuck could not read open tabs.");
  }
};

const restoreArchive = async (archiveId: string, background = false): Promise<Result<void>> => {
  const root = await repository.getRoot();
  if (!root.ok) return root;
  const archive = root.data.archivedTabs.find((item) => item.id === archiveId);
  if (!archive) return failure("TAB_NOT_FOUND", "This archive entry no longer exists.");
  if (!normalizeUrl(archive.url))
    return failure("INVALID_URL", "This archive has an invalid URL and was not opened.");
  try {
    await chrome.tabs.create({ url: archive.url, active: !background });
    return { ok: true, data: undefined };
  } catch {
    return failure(
      "TAB_RESTORE_FAILED",
      "Tuck could not open this archive. The saved entry remains available.",
    );
  }
};

const copyNote = async (noteId: string): Promise<Result<SavedNote>> => {
  const root = await repository.getRoot();
  if (!root.ok) return root;
  const note = root.data.notes.find((item) => item.id === noteId);
  if (!note) return failure("TAB_NOT_FOUND", "This saved item no longer exists.");
  const saved = await repository.upsertNote({
    ...note,
    copyCount: note.copyCount + 1,
    updatedAt: Date.now(),
  });
  if (!saved.ok) return saved;
  return { ok: true, data: saved.data.notes.find((item) => item.id === noteId)! };
};

const openNote = async (noteId: string): Promise<Result<void>> => {
  const root = await repository.getRoot();
  if (!root.ok) return root;
  const note = root.data.notes.find((item) => item.id === noteId);
  if (!note) return failure("TAB_NOT_FOUND", "This saved item no longer exists.");
  const url = normalizeUrl(note.value);
  if (!url) return failure("INVALID_URL", "Only valid http or https links can be opened.");
  try {
    if (note.openTarget === "current-tab") {
      const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!active?.id)
        return failure("TAB_NOT_FOUND", "There is no active tab to open this link in.");
      await chrome.tabs.update(active.id, { url });
    } else await chrome.tabs.create({ url });
    return { ok: true, data: undefined };
  } catch {
    return failure("UNKNOWN", "Tuck could not open this link.");
  }
};

const saveNote = async (note: SavedNote): Promise<Result<SavedNote>> => {
  if (note.kind === "url" && !normalizeUrl(note.value))
    return failure("INVALID_URL", "Enter a valid http or https URL.");
  const saved = await repository.upsertNote({ ...note, updatedAt: Date.now() });
  if (!saved.ok) return saved;
  return { ok: true, data: saved.data.notes.find((item) => item.id === note.id)! };
};

export const handleMessage = async (message: ExtensionMessage): Promise<Result<unknown>> => {
  switch (message.type) {
    case "GET_ROOT":
      return repository.getRoot();
    case "GET_ACTIVE_CONTEXT":
      return getActiveContext();
    case "GET_OPEN_TABS":
      return getOpenTabs();
    case "RUN_CLEANUP":
      return runCleanup();
    case "AUTO_GROUP_TABS": {
      const root = await repository.getRoot();
      return root.ok ? groupRelatedTabs(root.data.settings.includeAllWindows) : root;
    }
    case "GROUP_SUGGESTED_TABS":
      return groupSuggestedTabs(message.tabIds, message.label);
    case "ARCHIVE_TAB":
      return archiveAndCloseTab(message.tabId);
    case "PROTECT_TAB": {
      const now = Date.now();
      const expiresAt =
        message.duration === "forever"
          ? undefined
          : now + (message.duration === "hour" ? 3_600_000 : 86_400_000);
      return repository.setProtection({ tabId: message.tabId, expiresAt, createdAt: now });
    }
    case "RESTORE_ARCHIVE":
      return restoreArchive(message.archiveId, message.background);
    case "DELETE_ARCHIVE":
      return repository.deleteArchive(message.archiveId);
    case "UPSERT_NOTE":
      return saveNote(message.note);
    case "DELETE_NOTE":
      return repository.deleteNote(message.noteId);
    case "COPY_NOTE":
      return copyNote(message.noteId);
    case "OPEN_NOTE":
      return openNote(message.noteId);
    case "UPDATE_SETTINGS":
      return repository.updateSettings(message.patch);
    case "EXPORT_ROOT": {
      const root = await repository.getRoot();
      return root.ok ? { ok: true, data: exportRoot(root.data) } : root;
    }
    case "IMPORT_ROOT": {
      const parsed = parseImport(message.text);
      return parsed.ok ? repository.replace(parsed.data) : parsed;
    }
  }
};

export const installMessageHandler = (): void => {
  chrome.runtime.onMessage.addListener((value: unknown, _sender, sendResponse) => {
    if (!unknownMessage(value)) {
      sendResponse(failure("UNKNOWN", "Tuck received an invalid request."));
      return;
    }
    void handleMessage(value as ExtensionMessage).then(sendResponse, () =>
      sendResponse(failure("UNKNOWN", "Tuck could not complete that request.")),
    );
    return true;
  });
};

export const createSelectionNote = async (text: string, pageUrl?: string): Promise<void> => {
  const value = text.trim();
  if (!value) return;
  const now = Date.now();
  await saveNote({
    id: createId(),
    title: "Saved selection",
    value,
    kind: "text",
    primaryAction: "copy",
    openTarget: "new-tab",
    domains: pageUrl && getHostname(pageUrl) ? [getHostname(pageUrl)!] : [],
    tags: [],
    createdAt: now,
    updatedAt: now,
    copyCount: 0,
    pinned: false,
  });
};
