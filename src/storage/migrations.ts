import { createDefaultRoot, DEFAULT_TUCK_SENSE, storageRootSchema } from "./schema";
import type { StorageRoot } from "../domain/types";

export const migrateRoot = (value: unknown): StorageRoot | null => {
  if (value === undefined || value === null) return createDefaultRoot();
  if (
    typeof value === "object" &&
    value !== null &&
    "version" in value &&
    ((value as { version?: unknown }).version === 1 ||
      (value as { version?: unknown }).version === 2)
  ) {
    const previous = value as Record<string, unknown>;
    const migrated = storageRootSchema.safeParse({
      ...previous,
      version: 3,
      tuckSense:
        previous.version === 2 && typeof previous.tuckSense === "object" && previous.tuckSense
          ? { ...(previous.tuckSense as Record<string, unknown>), feedback: [] }
          : structuredClone(DEFAULT_TUCK_SENSE),
    });
    return migrated.success ? migrated.data : null;
  }
  const parsed = storageRootSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};
