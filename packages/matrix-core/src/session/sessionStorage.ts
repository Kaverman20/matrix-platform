import { DEFAULT_SESSION_STORAGE_KEY } from "../constants";
import type { MatrixSession, SessionStorageLike } from "./types";

export function saveMatrixSession(
  storage: SessionStorageLike,
  session: MatrixSession,
  key = DEFAULT_SESSION_STORAGE_KEY,
): void {
  storage.setItem(key, JSON.stringify(session));
}

export function loadMatrixSession(
  storage: SessionStorageLike,
  key = DEFAULT_SESSION_STORAGE_KEY,
): MatrixSession | null {
  const raw = storage.getItem(key);
  if (!raw) return null;

  try {
    return parseMatrixSession(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function clearMatrixSession(
  storage: SessionStorageLike,
  key = DEFAULT_SESSION_STORAGE_KEY,
): void {
  storage.removeItem(key);
}

function parseMatrixSession(value: unknown): MatrixSession | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<MatrixSession>;
  if (
    typeof candidate.baseUrl !== "string" ||
    typeof candidate.accessToken !== "string" ||
    typeof candidate.userId !== "string" ||
    typeof candidate.deviceId !== "string"
  ) {
    return null;
  }

  return {
    baseUrl: candidate.baseUrl,
    accessToken: candidate.accessToken,
    userId: candidate.userId,
    deviceId: candidate.deviceId,
  };
}

