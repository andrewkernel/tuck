import type {
  ArchivedTab,
  CleanupLogEntry,
  ExtensionSettings,
  ProtectedTab,
  Result,
  SavedNote,
  StorageRoot,
} from "../domain/types";
import { createId } from "../shared/ids";
import { migrateRoot } from "./migrations";
import { createDefaultRoot, storageRootSchema } from "./schema";

const ROOT_KEY = "tabshelf-root";
let writes = Promise.resolve();
const error = <T>(
  code: Result<T> extends never ? never : "STORAGE_READ_FAILED" | "STORAGE_WRITE_FAILED",
  message: string,
): Result<T> => ({ ok: false, error: { code, message } });

async function readUnchecked(): Promise<Result<StorageRoot>> {
  try {
    const data = await chrome.storage.local.get(ROOT_KEY);
    const root = migrateRoot(data[ROOT_KEY]);
    if (!root)
      return error(
        "STORAGE_READ_FAILED",
        "Stored TabShelf data is invalid. Export any recoverable data before resetting it.",
      );
    return { ok: true, data: root };
  } catch {
    return error(
      "STORAGE_READ_FAILED",
      "TabShelf could not read local data. Your tabs were not changed.",
    );
  }
}

export const repository = {
  async getRoot(): Promise<Result<StorageRoot>> {
    return readUnchecked();
  },

  async update(mutator: (root: StorageRoot) => StorageRoot): Promise<Result<StorageRoot>> {
    const operation = writes.then(async () => {
      const current = await readUnchecked();
      if (!current.ok) return current;
      const next = mutator(structuredClone(current.data));
      const parsed = storageRootSchema.safeParse(next);
      if (!parsed.success)
        return error<StorageRoot>(
          "STORAGE_WRITE_FAILED",
          "TabShelf refused to save invalid local data. Your existing data is safe.",
        );
      try {
        await chrome.storage.local.set({ [ROOT_KEY]: parsed.data });
        const confirmation = await readUnchecked();
        if (!confirmation.ok || JSON.stringify(confirmation.data) !== JSON.stringify(parsed.data)) {
          return error<StorageRoot>(
            "STORAGE_WRITE_FAILED",
            "TabShelf could not confirm the local save. The tab was not closed.",
          );
        }
        return confirmation;
      } catch {
        return error<StorageRoot>(
          "STORAGE_WRITE_FAILED",
          "TabShelf could not save local data. The tab was not closed.",
        );
      }
    });
    writes = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  },

  async replace(root: StorageRoot): Promise<Result<StorageRoot>> {
    const parsed = storageRootSchema.safeParse(root);
    if (!parsed.success)
      return error("STORAGE_WRITE_FAILED", "Imported data is not valid TabShelf data.");
    return this.update(() => parsed.data);
  },

  addArchive(archive: ArchivedTab) {
    return this.update((root) => ({ ...root, archivedTabs: [archive, ...root.archivedTabs] }));
  },

  deleteArchive(id: string) {
    return this.update((root) => ({
      ...root,
      archivedTabs: root.archivedTabs.filter((item) => item.id !== id),
    }));
  },

  upsertNote(note: SavedNote) {
    return this.update((root) => {
      const existing = root.notes.some((item) => item.id === note.id);
      return {
        ...root,
        notes: existing
          ? root.notes.map((item) => (item.id === note.id ? note : item))
          : [note, ...root.notes],
      };
    });
  },

  deleteNote(id: string) {
    return this.update((root) => ({ ...root, notes: root.notes.filter((item) => item.id !== id) }));
  },

  updateSettings(patch: Partial<ExtensionSettings>) {
    return this.update((root) => ({
      ...root,
      settings: {
        ...root.settings,
        ...patch,
        theme: patch.theme ?? root.settings.theme,
        customThemes: patch.customThemes ?? root.settings.customThemes,
      },
    }));
  },

  setProtection(protection: ProtectedTab) {
    return this.update((root) => ({
      ...root,
      protectedTabs: [
        ...root.protectedTabs.filter((item) => item.tabId !== protection.tabId),
        protection,
      ],
    }));
  },

  removeProtection(tabId: number) {
    return this.update((root) => ({
      ...root,
      protectedTabs: root.protectedTabs.filter((item) => item.tabId !== tabId),
    }));
  },

  addLog(entry: Omit<CleanupLogEntry, "id" | "at">) {
    return this.update((root) => ({
      ...root,
      cleanupLog: [{ id: createId(), at: Date.now(), ...entry }, ...root.cleanupLog].slice(0, 100),
    }));
  },

  async reset(): Promise<Result<StorageRoot>> {
    return this.replace(createDefaultRoot());
  },
};
