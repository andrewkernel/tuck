import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Archive,
  Download,
  Folder,
  Plus,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import type { ActiveContext, OpenTabCandidate } from "../background/messages";
import type { GroupTabsSummary } from "../background/group-tabs";
import type {
  ArchivedTab,
  CustomTheme,
  ExtensionSettings,
  Result,
  SavedNote,
  StorageRoot,
  ThemePreferences,
  ThemeTokens,
} from "../domain/types";
import { createId } from "../shared/ids";
import { matchesDomain } from "../shared/urls";
import { exportRoot } from "../storage/export-import";
import { DEFAULT_THEME_TOKENS } from "../storage/schema";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { EmptyState } from "./components/EmptyState";
import { NoteRow } from "./components/NoteRow";
import { send } from "./api";
import { applyTheme, resolveTheme, THEME_PRESETS, validateTheme } from "./theme";

type View = "tabs" | "notes" | "settings";
type EditorState = { note?: SavedNote; domain?: string } | null;
type Confirmation = { title: string; detail: string; label: string; action: () => void } | null;

const formatUnused = (minutes: number) =>
  minutes < 60 ? `unused ${minutes}m` : `unused ${Math.floor(minutes / 60)}h`;
const archiveGroups = (archives: ArchivedTab[]) => {
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startYesterday = startToday - 86_400_000;
  const startWeek = startToday - 6 * 86_400_000;
  return [
    ["Today", archives.filter((item) => item.archivedAt >= startToday)],
    [
      "Yesterday",
      archives.filter((item) => item.archivedAt >= startYesterday && item.archivedAt < startToday),
    ],
    [
      "This week",
      archives.filter((item) => item.archivedAt >= startWeek && item.archivedAt < startYesterday),
    ],
    ["Older", archives.filter((item) => item.archivedAt < startWeek)],
  ] as const;
};

export function App() {
  const [root, setRoot] = useState<StorageRoot | null>(null);
  const [active, setActive] = useState<ActiveContext>({ hostname: null });
  const [openTabs, setOpenTabs] = useState<OpenTabCandidate[]>([]);
  const [view, setView] = useState<View>("tabs");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("Loading local data…");
  const [editor, setEditor] = useState<EditorState>(null);
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const searchInput = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    const [stored, context, candidates] = await Promise.all([
      send<StorageRoot>({ type: "GET_ROOT" }),
      send<ActiveContext>({ type: "GET_ACTIVE_CONTEXT" }),
      send<OpenTabCandidate[]>({ type: "GET_OPEN_TABS" }),
    ]);
    if (stored.ok) {
      setRoot(stored.data);
      setNotice("");
    } else setNotice(stored.error.message);
    if (context.ok) setActive(context.data);
    if (candidates.ok) setOpenTabs(candidates.data);
  };
  useEffect(() => {
    void refresh();
  }, []);
  useEffect(() => {
    if (root)
      applyTheme(
        resolveTheme(root.settings.theme, root.settings.customThemes),
        root.settings.theme,
      );
  }, [root]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (
        event.key === "/" &&
        !(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)
      ) {
        event.preventDefault();
        searchInput.current?.focus();
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, []);

  const status = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 4_000);
  };
  const after = async <T,>(result: Promise<Result<T>>, success: string): Promise<boolean> => {
    const response = await result;
    if (!response.ok) {
      status(response.error.message);
      return false;
    }
    await refresh();
    status(success);
    return true;
  };
  const saveNote = (note: SavedNote) =>
    after(send<SavedNote>({ type: "UPSERT_NOTE", note }), "Saved locally.");
  const copyNote = async (note: SavedNote) => {
    try {
      await navigator.clipboard.writeText(note.value);
    } catch {
      status("Clipboard access is unavailable. Select and copy the saved value instead.");
      return;
    }
    await after(send<SavedNote>({ type: "COPY_NOTE", noteId: note.id }), "Copied to clipboard.");
  };
  const openNote = (note: SavedNote) =>
    void after(send<void>({ type: "OPEN_NOTE", noteId: note.id }), "Opened saved link.");
  const deleteNote = (note: SavedNote) =>
    setConfirmation({
      title: "Delete saved item?",
      detail: `Delete “${note.title}” permanently from local Tuck data?`,
      label: "Delete",
      action: () =>
        void after(
          send<StorageRoot>({ type: "DELETE_NOTE", noteId: note.id }),
          "Saved item deleted.",
        ),
    });
  const saveSettings = async (
    patch: Partial<ExtensionSettings>,
    message = "Settings saved locally.",
  ) => after(send<StorageRoot>({ type: "UPDATE_SETTINGS", patch }), message);

  if (!root)
    return (
      <main className="app loading">
        <span className="brand-mark" aria-hidden="true" />
        <p>{notice}</p>
      </main>
    );
  const matchingNotes = active.hostname
    ? root.notes.filter((note) =>
        note.domains.some((domain) => matchesDomain(active.hostname!, domain)),
      )
    : [];
  const needle = search.trim().toLowerCase();
  const archives = root.archivedTabs.filter(
    (item) =>
      !needle ||
      [item.title, item.url, item.domain, item.note ?? "", ...item.tags]
        .join(" ")
        .toLowerCase()
        .includes(needle),
  );

  return (
    <main className="app" aria-label="Tuck">
      <header className="toolbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          Tuck
        </div>
        <div className="toolbar-actions">
          <button className="button with-icon" onClick={() => void groupTabs()}>
            <Folder aria-hidden="true" size={16} strokeWidth={1.8} />
            Group tabs
          </button>
          <button className="button primary with-icon" onClick={() => void runCleanup()}>
            <Archive aria-hidden="true" size={16} strokeWidth={1.8} />
            Clean now
          </button>
        </div>
      </header>
      <nav className="tabs" aria-label="Main views">
        {(["tabs", "notes", "settings"] as View[]).map((item) => (
          <button
            key={item}
            className={`tab ${view === item ? "active" : ""}`}
            aria-current={view === item ? "page" : undefined}
            onClick={() => setView(item)}
          >
            {item[0].toUpperCase() + item.slice(1)}
          </button>
        ))}
      </nav>
      <div className="content">
        {view === "tabs" && (
          <TabsView
            search={search}
            setSearch={setSearch}
            searchInput={searchInput}
            hostname={active.hostname}
            matchingNotes={matchingNotes}
            openTabs={openTabs}
            archives={archives}
            settings={root.settings}
            onCopy={copyNote}
            onOpen={openNote}
            onSave={saveNote}
            onAddNote={(domain) => setEditor({ domain })}
            onArchive={(tabId) =>
              void after(
                send<ArchivedTab>({ type: "ARCHIVE_TAB", tabId }),
                "Tab archived before closing.",
              )
            }
            onProtect={(tabId) =>
              void after(
                send<StorageRoot>({ type: "PROTECT_TAB", tabId, duration: "hour" }),
                "Tab protected for one hour.",
              )
            }
            onRestore={(archiveId, background) =>
              void after(
                send<void>({ type: "RESTORE_ARCHIVE", archiveId, background }),
                "Archive opened. The saved entry remains available.",
              )
            }
            onDeleteArchive={(archive) =>
              setConfirmation({
                title: "Delete archive entry?",
                detail: `Delete “${archive.title}” permanently? This does not affect any open tab.`,
                label: "Delete",
                action: () =>
                  void after(
                    send<StorageRoot>({ type: "DELETE_ARCHIVE", archiveId: archive.id }),
                    "Archive entry deleted.",
                  ),
              })
            }
          />
        )}
        {view === "notes" && (
          <NotesView
            notes={root.notes}
            onCopy={copyNote}
            onOpen={openNote}
            onSave={saveNote}
            onDelete={deleteNote}
            onAdd={() => setEditor({})}
          />
        )}
        {view === "settings" && (
          <SettingsView
            root={root}
            onSaveSettings={saveSettings}
            onImport={async (text) =>
              after(send<StorageRoot>({ type: "IMPORT_ROOT", text }), "Data imported locally.")
            }
            onExport={() => downloadExport(root, status)}
            onReset={() =>
              setConfirmation({
                title: "Clear all local data?",
                detail:
                  "This permanently deletes Tuck archives, notes, settings, and protection rules from this browser.",
                label: "Clear all data",
                action: () =>
                  void after(
                    send<StorageRoot>({
                      type: "IMPORT_ROOT",
                      text: exportRoot({
                        ...root,
                        archivedTabs: [],
                        notes: [],
                        protectedTabs: [],
                        cleanupLog: [],
                      }),
                    }),
                    "Local archive and notes cleared.",
                  ),
              })
            }
          />
        )}
      </div>
      <footer className="statusbar">
        <span>
          {notice ||
            `${root.archivedTabs.length} archived · cleanup after ${formatMinutes(root.settings.archiveAfterMinutes)}`}
        </span>
        <button className="text-button" onClick={() => setView("settings")}>
          Settings
        </button>
      </footer>
      {editor && (
        <NoteEditor
          initial={editor.note}
          domain={editor.domain}
          onSave={async (note) => {
            const ok = await saveNote(note);
            if (ok) setEditor(null);
            return ok;
          }}
          onCancel={() => setEditor(null)}
        />
      )}
      {confirmation && (
        <ConfirmDialog
          title={confirmation.title}
          detail={confirmation.detail}
          confirmLabel={confirmation.label}
          onCancel={() => setConfirmation(null)}
          onConfirm={() => {
            confirmation.action();
            setConfirmation(null);
          }}
        />
      )}
    </main>
  );

  async function runCleanup() {
    const response = await send<{
      discarded: number;
      archived: number;
      skipped: number;
      errors: string[];
    }>({ type: "RUN_CLEANUP" });
    if (!response.ok) {
      status(response.error.message);
      return;
    }
    const { discarded, archived, skipped, errors } = response.data;
    status(
      errors[0] ??
        `Cleanup complete: ${archived} archived, ${discarded} discarded${skipped ? `, ${skipped} protected skipped` : ""}.`,
    );
    await refresh();
  }

  async function groupTabs() {
    const response = await send<GroupTabsSummary>({ type: "AUTO_GROUP_TABS" });
    if (!response.ok) {
      status(response.error.message);
      return;
    }
    const { groups, tabs, errors } = response.data;
    status(
      errors[0] ??
        (groups
          ? `Tuck grouped ${tabs} tabs across ${groups} site group${groups === 1 ? "" : "s"}.`
          : "No matching ungrouped tabs to organize."),
    );
    await refresh();
  }
}

function TabsView({
  search,
  setSearch,
  searchInput,
  hostname,
  matchingNotes,
  openTabs,
  archives,
  settings,
  onCopy,
  onOpen,
  onSave,
  onAddNote,
  onArchive,
  onProtect,
  onRestore,
  onDeleteArchive,
}: {
  search: string;
  setSearch: (value: string) => void;
  searchInput: React.RefObject<HTMLInputElement | null>;
  hostname: string | null;
  matchingNotes: SavedNote[];
  openTabs: OpenTabCandidate[];
  archives: ArchivedTab[];
  settings: ExtensionSettings;
  onCopy: (note: SavedNote) => void;
  onOpen: (note: SavedNote) => void;
  onSave: (note: SavedNote) => Promise<boolean>;
  onAddNote: (domain: string) => void;
  onArchive: (tabId: number) => void;
  onProtect: (tabId: number) => void;
  onRestore: (archiveId: string, background: boolean) => void;
  onDeleteArchive: (archive: ArchivedTab) => void;
}) {
  return (
    <>
      <div className="search">
        <label htmlFor="archive-search">Search tabs</label>
        <input
          ref={searchInput}
          id="archive-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search archived tabs"
        />
      </div>
      <section className="section">
        <h2>Current site</h2>
        {hostname ? (
          <>
            <p className="section-detail">{hostname}</p>
            {matchingNotes.slice(0, 5).map((note) => (
              <NoteRow key={note.id} note={note} onCopy={onCopy} onOpen={onOpen} onSave={onSave} />
            ))}
            {matchingNotes.length === 0 && <EmptyState>No saved items for this site.</EmptyState>}
            <button className="add-row with-icon" onClick={() => onAddNote(hostname)}>
              <Plus aria-hidden="true" size={16} strokeWidth={1.8} />
              Add a note for {hostname}
            </button>
          </>
        ) : (
          <EmptyState>Open a normal web page to see matching saved items.</EmptyState>
        )}
      </section>
      <section className="section">
        <h2>Open tabs</h2>
        {openTabs.length === 0 ? (
          <EmptyState>No safe inactive tabs in this window.</EmptyState>
        ) : (
          openTabs.map((tab) => (
            <article className="row tab-row" key={tab.id}>
              <Favicon url={tab.faviconUrl} domain={tab.domain} settings={settings} />
              <div className="row-main">
                <p className="row-title static">{tab.title}</p>
                <p className="row-meta">
                  {tab.domain} · {formatUnused(tab.unusedMinutes)}
                </p>
              </div>
              <div className="row-actions">
                <button className="text-button with-icon" onClick={() => onProtect(tab.id)}>
                  <ShieldCheck aria-hidden="true" size={15} strokeWidth={1.8} />
                  Keep
                </button>
                <button
                  className="text-button with-icon"
                  disabled={tab.protected}
                  onClick={() => onArchive(tab.id)}
                >
                  <Archive aria-hidden="true" size={15} strokeWidth={1.8} />
                  {tab.protected ? "Protected" : "Archive"}
                </button>
              </div>
            </article>
          ))
        )}
      </section>
      <section className="section">
        <h2>Archived tabs</h2>
        {archives.length === 0 ? (
          <EmptyState>No archived tabs. Tabs closed by Tuck will appear here.</EmptyState>
        ) : (
          archiveGroups(archives).map(
            ([label, items]) =>
              items.length > 0 && (
                <div key={label}>
                  <h3>{label}</h3>
                  {items.map((archive) => (
                    <article className="row tab-row" key={archive.id}>
                      <Favicon
                        url={archive.faviconUrl}
                        domain={archive.domain}
                        settings={settings}
                      />
                      <div className="row-main">
                        <button className="row-title" onClick={() => onRestore(archive.id, false)}>
                          {archive.title}
                        </button>
                        <p className="row-meta">
                          {archive.domain} · archived {formatAgo(archive.archivedAt)}
                        </p>
                      </div>
                      <div className="row-actions">
                        <button
                          className="text-button with-icon"
                          onClick={() => onRestore(archive.id, false)}
                        >
                          <RotateCcw aria-hidden="true" size={15} strokeWidth={1.8} />
                          Restore
                        </button>
                        <button
                          className="text-button danger-text with-icon"
                          onClick={() => onDeleteArchive(archive)}
                        >
                          <Trash2 aria-hidden="true" size={15} strokeWidth={1.8} />
                          Delete
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ),
          )
        )}
      </section>
    </>
  );
}

function NotesView({
  notes,
  onCopy,
  onOpen,
  onSave,
  onDelete,
  onAdd,
}: {
  notes: SavedNote[];
  onCopy: (note: SavedNote) => void;
  onOpen: (note: SavedNote) => void;
  onSave: (note: SavedNote) => Promise<boolean>;
  onDelete: (note: SavedNote) => void;
  onAdd: () => void;
}) {
  return (
    <section className="section notes-view">
      <div className="section-title-row">
        <h2>Saved items</h2>
        <button className="button with-icon" onClick={onAdd}>
          <Plus aria-hidden="true" size={16} strokeWidth={1.8} />
          Add note
        </button>
      </div>
      {notes.length === 0 ? (
        <EmptyState>No saved items. Add reusable text or a link.</EmptyState>
      ) : (
        notes
          .slice()
          .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt)
          .map((note) => (
            <NoteRow
              key={note.id}
              note={note}
              onCopy={onCopy}
              onOpen={onOpen}
              onSave={onSave}
              onDelete={onDelete}
            />
          ))
      )}
    </section>
  );
}

function NoteEditor({
  initial,
  domain,
  onSave,
  onCancel,
}: {
  initial?: SavedNote;
  domain?: string;
  onSave: (note: SavedNote) => Promise<boolean>;
  onCancel: () => void;
}) {
  const now = Date.now();
  const [draft, setDraft] = useState<SavedNote>(
    initial ?? {
      id: createId(),
      title: "",
      value: "",
      kind: "text",
      primaryAction: "copy",
      openTarget: "new-tab",
      domains: domain ? [domain] : [],
      tags: [],
      createdAt: now,
      updatedAt: now,
      copyCount: 0,
      pinned: false,
    },
  );
  const update = <K extends keyof SavedNote>(key: K, value: SavedNote[K]) =>
    setDraft((item) => ({ ...item, [key]: value }));
  return (
    <Dialog.Root open onOpenChange={(open) => !open && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-backdrop" />
        <Dialog.Content className="dialog editor-dialog">
          <Dialog.Title>{initial ? "Edit saved item" : "Add saved item"}</Dialog.Title>
          <Dialog.Description className="visually-hidden">
            Save reusable text or a link for Tuck.
          </Dialog.Description>
          <label>
            Title
            <input
              autoFocus
              value={draft.title}
              onChange={(event) => update("title", event.target.value)}
            />
          </label>
          <label>
            Value
            <textarea
              value={draft.value}
              onChange={(event) => update("value", event.target.value)}
            />
          </label>
          <div className="form-grid">
            <label>
              Kind
              <select
                value={draft.kind}
                onChange={(event) => update("kind", event.target.value as SavedNote["kind"])}
              >
                {["text", "url", "email", "profile", "project", "resume", "form"].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label>
              Primary click
              <select
                value={draft.primaryAction}
                onChange={(event) =>
                  update("primaryAction", event.target.value as SavedNote["primaryAction"])
                }
              >
                {["copy", "open", "edit"].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
          </div>
          {draft.kind === "url" && (
            <label>
              Open link in
              <select
                value={draft.openTarget}
                onChange={(event) =>
                  update("openTarget", event.target.value as SavedNote["openTarget"])
                }
              >
                <option value="new-tab">New tab</option>
                <option value="current-tab">Current tab</option>
              </select>
            </label>
          )}
          <label>
            Domains <span className="field-hint">(comma separated)</span>
            <input
              value={draft.domains.join(", ")}
              onChange={(event) =>
                update(
                  "domains",
                  event.target.value
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean),
                )
              }
            />
          </label>
          <div className="dialog-actions">
            <Dialog.Close asChild>
              <button className="button">Cancel</button>
            </Dialog.Close>
            <button
              className="button primary"
              disabled={!draft.title.trim() || !draft.value.trim()}
              onClick={() => void onSave(draft)}
            >
              Save
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function SettingsView({
  root,
  onSaveSettings,
  onImport,
  onExport,
  onReset,
}: {
  root: StorageRoot;
  onSaveSettings: (patch: Partial<ExtensionSettings>, message?: string) => Promise<boolean>;
  onImport: (text: string) => Promise<boolean>;
  onExport: () => void;
  onReset: () => void;
}) {
  const [cleanup, setCleanup] = useState(root.settings);
  const [tokens, setTokens] = useState(
    resolveTheme(root.settings.theme, root.settings.customThemes),
  );
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setCleanup(root.settings);
    setTokens(resolveTheme(root.settings.theme, root.settings.customThemes));
  }, [root.settings]);
  const updateTheme = async (patch: Partial<ThemePreferences>) => {
    const theme = { ...root.settings.theme, ...patch };
    applyTheme(resolveTheme(theme, root.settings.customThemes), theme);
    await onSaveSettings({ theme }, "Theme saved locally.");
  };
  const saveCustom = async () => {
    const check = validateTheme(tokens);
    if (!check.valid) return;
    const now = Date.now();
    const custom: CustomTheme = {
      id: createId(),
      name: `Custom theme ${root.settings.customThemes.length + 1}`,
      tokens,
      createdAt: now,
      updatedAt: now,
    };
    await onSaveSettings(
      {
        customThemes: [...root.settings.customThemes, custom],
        theme: { ...root.settings.theme, preset: "custom", customThemeId: custom.id, tokens },
      },
      "Custom theme saved locally.",
    );
  };
  const contrast = validateTheme(tokens);
  return (
    <section className="settings-view">
      <form
        className="section"
        onSubmit={(event) => {
          event.preventDefault();
          void onSaveSettings(cleanup);
        }}
      >
        <h2>Cleanup</h2>
        <label className="check-row">
          <input
            type="checkbox"
            checked={cleanup.cleanupEnabled}
            onChange={(event) => setCleanup({ ...cleanup, cleanupEnabled: event.target.checked })}
          />
          Enable automatic cleanup
        </label>
        <div className="form-grid">
          <NumberField
            label="Discard after (minutes)"
            value={cleanup.discardAfterMinutes}
            onChange={(value) => setCleanup({ ...cleanup, discardAfterMinutes: value })}
          />
          <NumberField
            label="Archive after (minutes)"
            value={cleanup.archiveAfterMinutes}
            onChange={(value) => setCleanup({ ...cleanup, archiveAfterMinutes: value })}
          />
        </div>
        <NumberField
          label="Cleanup interval (minutes)"
          value={cleanup.cleanupIntervalMinutes}
          onChange={(value) => setCleanup({ ...cleanup, cleanupIntervalMinutes: value })}
        />
        <label className="check-row">
          <input
            type="checkbox"
            checked={cleanup.includeAllWindows}
            onChange={(event) =>
              setCleanup({ ...cleanup, includeAllWindows: event.target.checked })
            }
          />
          Include tabs from all windows
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={cleanup.closeDuplicates}
            onChange={(event) => setCleanup({ ...cleanup, closeDuplicates: event.target.checked })}
          />
          Archive duplicate tabs when safe
        </label>
        <button className="button primary" type="submit">
          Save cleanup settings
        </button>
      </form>
      <section className="section">
        <h2>Protection</h2>
        <label className="check-row">
          <input
            type="checkbox"
            checked={cleanup.protectPinned}
            onChange={(event) => {
              const patch = { protectPinned: event.target.checked };
              setCleanup({ ...cleanup, ...patch });
              void onSaveSettings(patch);
            }}
          />
          Never close pinned tabs
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={cleanup.protectAudible}
            onChange={(event) => {
              const patch = { protectAudible: event.target.checked };
              setCleanup({ ...cleanup, ...patch });
              void onSaveSettings(patch);
            }}
          />
          Never close tabs playing audio
        </label>
        <label>
          Protected domains <span className="field-hint">(one per line)</span>
          <textarea
            value={cleanup.protectedDomains.join("\n")}
            onChange={(event) =>
              setCleanup({
                ...cleanup,
                protectedDomains: event.target.value
                  .split("\n")
                  .map((item) => item.trim())
                  .filter(Boolean),
              })
            }
            onBlur={() => void onSaveSettings({ protectedDomains: cleanup.protectedDomains })}
            placeholder="example.com"
          />
        </label>
      </section>
      <section className="section">
        <h2>Appearance</h2>
        <label>
          Theme
          <select
            value={root.settings.theme.preset}
            onChange={(event) =>
              void updateTheme({
                preset: event.target.value as ThemePreferences["preset"],
                tokens: undefined,
                customThemeId: undefined,
              })
            }
          >
            {Object.keys(THEME_PRESETS).map((item) => (
              <option key={item} value={item}>
                {item[0].toUpperCase() + item.slice(1)}
              </option>
            ))}
            {root.settings.customThemes.length > 0 && <option value="custom">Custom</option>}
          </select>
        </label>
        <div className="theme-preview">
          <span style={{ backgroundColor: tokens.background }} />
          <span style={{ backgroundColor: tokens.surface }} />
          <span style={{ backgroundColor: tokens.accent }} />
          <span style={{ backgroundColor: tokens.text }} />
        </div>
        <div className="form-grid">
          <label>
            Density
            <select
              value={root.settings.theme.density}
              onChange={(event) =>
                void updateTheme({ density: event.target.value as ThemePreferences["density"] })
              }
            >
              <option value="compact">Compact</option>
              <option value="comfortable">Comfortable</option>
              <option value="spacious">Spacious</option>
            </select>
          </label>
          <label>
            Corners
            <select
              value={root.settings.theme.radius}
              onChange={(event) =>
                void updateTheme({ radius: event.target.value as ThemePreferences["radius"] })
              }
            >
              <option value="square">Square</option>
              <option value="subtle">Subtle</option>
              <option value="rounded">Rounded</option>
            </select>
          </label>
        </div>
        <div className="form-grid">
          <label>
            Font
            <select
              value={root.settings.theme.font}
              onChange={(event) =>
                void updateTheme({ font: event.target.value as ThemePreferences["font"] })
              }
            >
              <option value="sans">Sans</option>
              <option value="mono">Mono</option>
            </select>
          </label>
          <label className="check-row">
            Favicons
            <input
              type="checkbox"
              checked={root.settings.theme.showFavicons}
              onChange={(event) => void updateTheme({ showFavicons: event.target.checked })}
            />
          </label>
        </div>
        <details>
          <summary>Customize colors</summary>
          <div className="color-grid">
            {(Object.keys(DEFAULT_THEME_TOKENS) as (keyof ThemeTokens)[]).map((key) => (
              <label key={key}>
                {key.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)}
                <input
                  type="color"
                  value={tokens[key]}
                  onChange={(event) => {
                    const next = { ...tokens, [key]: event.target.value };
                    setTokens(next);
                    applyTheme(next, root.settings.theme);
                  }}
                />
              </label>
            ))}
          </div>
          <p className={contrast.valid ? "contrast-ok" : "inline-error"}>
            {contrast.valid
              ? `Contrast: good (${contrast.contrast.toFixed(1)}:1)`
              : contrast.warning}
          </p>
          <button className="button" disabled={!contrast.valid} onClick={() => void saveCustom()}>
            Save as new theme
          </button>
        </details>
      </section>
      <section className="section">
        <h2>Storage</h2>
        <p className="section-detail">
          {new Blob([JSON.stringify(root)]).size.toLocaleString()} bytes used locally.
        </p>
        <div className="button-row">
          <button className="button with-icon" onClick={onExport}>
            <Download aria-hidden="true" size={16} strokeWidth={1.8} />
            Export JSON
          </button>
          <button className="button with-icon" onClick={() => file.current?.click()}>
            <Upload aria-hidden="true" size={16} strokeWidth={1.8} />
            Import JSON
          </button>
          <button className="button danger-outline with-icon" onClick={onReset}>
            <Trash2 aria-hidden="true" size={16} strokeWidth={1.8} />
            Clear archive and notes
          </button>
        </div>
        <input
          ref={file}
          className="visually-hidden"
          type="file"
          accept="application/json,.json"
          onChange={(event) => {
            const selected = event.target.files?.[0];
            if (selected) void selected.text().then(onImport);
            event.currentTarget.value = "";
          }}
        />
      </section>
    </section>
  );
}

const NumberField = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) => (
  <label>
    {label}
    <input
      type="number"
      min="5"
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
    />
  </label>
);
const Favicon = ({
  url,
  domain,
  settings,
}: {
  url?: string;
  domain: string;
  settings: ExtensionSettings;
}) =>
  settings.theme.showFavicons ? (
    <div className="favicon">{url ? <img src={url} alt="" /> : domain[0]?.toUpperCase()}</div>
  ) : null;
const formatMinutes = (minutes: number) =>
  minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h`;
const formatAgo = (time: number) => {
  const minutes = Math.floor((Date.now() - time) / 60_000);
  return minutes < 60
    ? `${Math.max(1, minutes)}m ago`
    : minutes < 1_440
      ? `${Math.floor(minutes / 60)}h ago`
      : `${Math.floor(minutes / 1_440)}d ago`;
};
const downloadExport = (root: StorageRoot, status: (message: string) => void) => {
  const url = URL.createObjectURL(new Blob([exportRoot(root)], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `tuck-export-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  status("Export downloaded.");
};
