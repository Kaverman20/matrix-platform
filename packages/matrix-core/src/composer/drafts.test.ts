import { describe, expect, it } from "vitest";
import { clearRoomDraft, loadRoomDraft, saveRoomDraft } from "./drafts";

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.get(key) ?? null;
    },
    key(index: number) {
      return [...map.keys()][index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
  };
}

describe("drafts", () => {
  it("loads and saves per-room drafts", () => {
    const storage = memoryStorage();
    saveRoomDraft(storage, "!a:server", "hello");
    expect(loadRoomDraft(storage, "!a:server")).toBe("hello");
    expect(loadRoomDraft(storage, "!b:server")).toBe("");
  });

  it("clears empty drafts", () => {
    const storage = memoryStorage();
    saveRoomDraft(storage, "!a:server", "hello");
    saveRoomDraft(storage, "!a:server", "   ");
    expect(loadRoomDraft(storage, "!a:server")).toBe("");
    clearRoomDraft(storage, "!a:server");
    expect(loadRoomDraft(storage, "!a:server")).toBe("");
  });
});
