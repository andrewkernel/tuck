import type { Result, StorageRoot } from "../domain/types";
import { migrateRoot } from "./migrations";

export const exportRoot = (root: StorageRoot): string => JSON.stringify(root, null, 2);

export const parseImport = (text: string): Result<StorageRoot> => {
  try {
    const parsed = migrateRoot(JSON.parse(text));
    if (!parsed)
      return {
        ok: false,
        error: { code: "IMPORT_INVALID", message: "This file is not valid Tuck data." },
      };
    return { ok: true, data: parsed };
  } catch {
    return {
      ok: false,
      error: { code: "IMPORT_INVALID", message: "This file is not valid JSON." },
    };
  }
};
