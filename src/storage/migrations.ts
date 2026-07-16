import { createDefaultRoot, storageRootSchema } from "./schema";
import type { StorageRoot } from "../domain/types";

export const migrateRoot = (value: unknown): StorageRoot | null => {
  if (value === undefined || value === null) return createDefaultRoot();
  if (
    typeof value === "object" &&
    value !== null &&
    "version" in value &&
    [1, 2, 3].includes((value as { version?: unknown }).version as number)
  ) {
    const previous = value as Record<string, unknown>;
    const migratedValue: Record<string, unknown> = { ...previous, version: 4 };
    delete migratedValue.tuckSense;
    const migrated = storageRootSchema.safeParse(migratedValue);
    return migrated.success ? migrated.data : null;
  }
  const parsed = storageRootSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};
