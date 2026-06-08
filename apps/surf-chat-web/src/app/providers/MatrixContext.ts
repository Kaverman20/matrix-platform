import { createContext, useContext } from "react";
import type { MatrixClient } from "matrix-js-sdk";

export type MatrixStatus = "anonymous" | "connecting" | "ready" | "error";

export type MatrixContextValue = {
  client: MatrixClient | null;
  status: MatrixStatus;
  error: string | null;
  userId: string | null;
  defaultHomeserver: string;
  loginPassword: (
    homeserver: string,
    user: string,
    password: string,
  ) => Promise<void>;
  loginAccessToken: (homeserver: string, accessToken: string) => Promise<void>;
  loginSso: (homeserver: string, idpId: string | null) => Promise<void>;
  logout: () => Promise<void>;
};

export const MatrixContext = createContext<MatrixContextValue | null>(null);

export function useMatrix(): MatrixContextValue {
  const ctx = useContext(MatrixContext);
  if (!ctx) throw new Error("useMatrix must be used inside MatrixProvider");
  return ctx;
}

