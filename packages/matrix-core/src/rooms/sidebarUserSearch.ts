import type { UserDirectoryEntry } from "./createRoom";

const MATRIX_USER_ID = /^@[^:\s]+:[^:\s]+$/;

/** True when the string looks like a full Matrix user id. */
export function isMatrixUserId(value: string): boolean {
  return MATRIX_USER_ID.test(value.trim());
}

/** Collects peer user ids from existing DM room summaries. */
export function collectExistingDmUserIds(
  directUserIds: Array<string | undefined>,
): Set<string> {
  return new Set(directUserIds.filter((id): id is string => Boolean(id)));
}

/**
 * Merges homeserver directory hits with a direct Matrix ID entry and drops
 * users who already have a DM in the sidebar list.
 */
export function resolveSidebarUserSearch(
  query: string,
  directoryResults: UserDirectoryEntry[],
  existingDmUserIds: Set<string>,
): UserDirectoryEntry[] {
  const trimmed = query.trim();
  const filtered = directoryResults.filter((entry) => !existingDmUserIds.has(entry.user_id));

  if (!isMatrixUserId(trimmed)) return filtered;

  if (existingDmUserIds.has(trimmed)) return filtered;
  if (filtered.some((entry) => entry.user_id === trimmed)) return filtered;

  return [{ user_id: trimmed }, ...filtered];
}
