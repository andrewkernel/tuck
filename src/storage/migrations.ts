import { createDefaultRoot, storageRootSchema } from "./schema";
import type { StorageRoot } from "../domain/types";

export const migrateRoot = (value: unknown): StorageRoot | null => {
  if (value === undefined || value === null) return createDefaultRoot();
  const parsed = storageRootSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};
