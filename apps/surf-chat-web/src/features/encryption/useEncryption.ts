import { useCallback, useState } from "react";
import type { MatrixClient } from "matrix-js-sdk";
import {
  enableEncryption,
  getEncryptionStatus,
  makePasswordAuthCallback,
  restoreEncryptionWithRecoveryKey,
  setupEncryptionRecovery,
} from "@matrix-platform/matrix-core";

type Options = {
  client: MatrixClient | null;
};

/** Where the encryption setup flow currently is. */
export type EncryptionPhase =
  | "loading" // checking status
  | "ready" // cross-signing + secret storage are good on this device
  | "needs-setup" // no recovery on the account — offer to create it
  | "needs-unlock" // recovery exists — ask for the key to verify this device
  | "show-key" // freshly generated recovery key, shown once
  | "error";

export function useEncryption({ client }: Options) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<EncryptionPhase>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [keyInput, setKeyInput] = useState("");

  const refresh = useCallback(async () => {
    if (!client) return;
    setPhase("loading");
    setError(null);
    try {
      await enableEncryption(client);
      const status = await getEncryptionStatus(client);
      if (status.crossSigningReady && status.secretStorageReady) setPhase("ready");
      else if (status.recoveryExists) setPhase("needs-unlock");
      else setPhase("needs-setup");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось проверить шифрование");
      setPhase("error");
    }
  }, [client]);

  const openModal = useCallback(() => {
    setOpen(true);
    setError(null);
    setRecoveryKey(null);
    setPassword("");
    setKeyInput("");
    void refresh();
  }, [refresh]);

  const close = useCallback(() => {
    setOpen(false);
    setError(null);
    setRecoveryKey(null);
    setPassword("");
    setKeyInput("");
  }, []);

  const runSetup = useCallback(async () => {
    const userId = client?.getUserId();
    if (!client || !userId) return;
    setBusy(true);
    setError(null);
    try {
      const key = await setupEncryptionRecovery(client, {
        authUploadDeviceSigningKeys: makePasswordAuthCallback(userId, password),
      });
      setPassword("");
      setRecoveryKey(key);
      setPhase("show-key");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось включить шифрование");
    } finally {
      setBusy(false);
    }
  }, [client, password]);

  const runUnlock = useCallback(async () => {
    if (!client) return;
    setBusy(true);
    setError(null);
    try {
      await restoreEncryptionWithRecoveryKey(client, keyInput);
      setKeyInput("");
      await refresh();
    } catch {
      setError("Неверный ключ восстановления");
    } finally {
      setBusy(false);
    }
  }, [client, keyInput, refresh]);

  const finishShowKey = useCallback(() => {
    setRecoveryKey(null);
    void refresh();
  }, [refresh]);

  return {
    open,
    phase,
    busy,
    error,
    recoveryKey,
    password,
    setPassword,
    keyInput,
    setKeyInput,
    openModal,
    close,
    runSetup,
    runUnlock,
    finishShowKey,
  };
}
