import { describe, expect, it } from "vitest";
import {
  clearMatrixSession,
  loadMatrixSession,
  saveMatrixSession,
} from "./sessionStorage";
import type { MatrixSession, SessionStorageLike } from "./types";

function fakeStorage(): SessionStorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
}

const session: MatrixSession = {
  baseUrl: "https://matrix.foxhound.run",
  accessToken: "syt_token",
  userId: "@user:matrix.foxhound.run",
  deviceId: "DEVICE",
};

describe("matrix session storage", () => {
  it("round-trips a saved session", () => {
    const storage = fakeStorage();
    saveMatrixSession(storage, session);
    expect(loadMatrixSession(storage)).toEqual(session);
  });

  it("returns null when nothing is stored", () => {
    expect(loadMatrixSession(fakeStorage())).toBeNull();
  });

  it("returns null on malformed json", () => {
    const storage = fakeStorage();
    storage.setItem("surf-chat:session", "{not json");
    expect(loadMatrixSession(storage)).toBeNull();
  });

  it("returns null when required fields are missing", () => {
    const storage = fakeStorage();
    storage.setItem("surf-chat:session", JSON.stringify({ baseUrl: "x" }));
    expect(loadMatrixSession(storage)).toBeNull();
  });

  it("clears a stored session", () => {
    const storage = fakeStorage();
    saveMatrixSession(storage, session);
    clearMatrixSession(storage);
    expect(loadMatrixSession(storage)).toBeNull();
  });
});
