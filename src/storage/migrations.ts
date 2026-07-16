import { createDefaultRoot, DEFAULT_TUCK_SENSE, storageRootSchema } from "./schema";
import type { StorageRoot } from "../domain/types";

export const migrateRoot = (value: unknown): StorageRoot | null => {
  if (value === undefined || value === null) return createDefaultRoot();
  if (
    typeof value === "object" &&
    value !== null &&
    "version" in value &&
    (value as { version?: unknown }).version === 1
  ) {
    const migrated = storageRootSchema.safeParse({
      ...(value as Record<string, unknown>),
      version: 2,
      tuckSense: structuredClone(DEFAULT_TUCK_SENSE),
    });
    return migrated.success ? migrated.data : null;
  }
  const parsed = storageRootSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};
