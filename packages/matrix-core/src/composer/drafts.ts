const DRAFTS_STORAGE_KEY = "surf-chat:drafts:v1";

export type DraftStorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function loadRoomDraft(
  storage: DraftStorageLike,
  roomId: string,
): string {
  const map = readDraftMap(storage);
  return map[roomId] ?? "";
}

export function saveRoomDraft(
  storage: DraftStorageLike,
  roomId: string,
  text: string,
): void {
  const map = readDraftMap(storage);
  const trimmed = text;
  if (!trimmed.trim()) {
    delete map[roomId];
  } else {
    map[roomId] = trimmed;
  }
  writeDraftMap(storage, map);
}

export function clearRoomDraft(
  storage: DraftStorageLike,
  roomId: string,
): void {
  const map = readDraftMap(storage);
  delete map[roomId];
  writeDraftMap(storage, map);
}

function readDraftMap(storage: DraftStorageLike): Record<string, string> {
  const raw = storage.getItem(DRAFTS_STORAGE_KEY);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const map: Record<string, string> = {};
    for (const [roomId, draft] of Object.entries(parsed)) {
      if (typeof draft === "string") map[roomId] = draft;
    }
    return map;
  } catch {
    return {};
  }
}

function writeDraftMap(storage: DraftStorageLike, map: Record<string, string>): void {
  if (Object.keys(map).length === 0) {
    storage.removeItem(DRAFTS_STORAGE_KEY);
    return;
  }
  storage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(map));
}
