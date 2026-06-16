import { useCallback, useRef, useState } from "react";
import type { MatrixClient } from "matrix-js-sdk";
import {
  commitEncryptionRecovery,
  enableEncryption,
  generateRecoveryKey,
  getEncryptionStatus,
  makePasswordAuthCallback,
  restoreEncryptionWithRecoveryKey,
  type GeneratedSecretStorageKey,
} from "@matrix-platform/matrix-core";

type Options = {
  client: MatrixClient | null;
};

/** Where the encryption setup flow currently is. */
export type EncryptionPhase =
  | "loading" // checking status
  | "ready" // cross-signing + secret storage are good on this device
  | "needs-setup" // no recovery on the account — offer to create it
  | "show-key" // freshly generated recovery key, shown before commit
  | "password" // account password requested for the final server verification
  | "working" // bootstrapping against the server
  | "needs-unlock" // recovery exists — ask for the key to verify this device
  | "error";

export function useEncryption({ client }: Options) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<EncryptionPhase>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [keyInput, setKeyInput] = useState("");

  // The generated key object, held until the user confirms they saved it and we
  // commit it to the server. The password resolver bridges the lazy UIA callback
  // (deep in the SDK) back to the password field in the modal.
  const generatedKeyRef = useRef<GeneratedSecretStorageKey | null>(null);
  const passwordResolveRef = useRef<((value: string) => void) | null>(null);

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
    generatedKeyRef.current = null;
    void refresh();
  }, [refresh]);

  const close = useCallback(() => {
    setOpen(false);
    setError(null);
    setRecoveryKey(null);
    setPassword("");
    setKeyInput("");
    generatedKeyRef.current = null;
    passwordResolveRef.current = null;
  }, []);

  // Step 1: generate the key locally and show it. Nothing hits the server yet.
  const startSetup = useCallback(async () => {
    if (!client) return;
    setBusy(true);
    setError(null);
    try {
      const key = await generateRecoveryKey(client);
      generatedKeyRef.current = key;
      setRecoveryKey(key.encodedPrivateKey ?? null);
      setPhase("show-key");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось создать ключ");
    } finally {
      setBusy(false);
    }
  }, [client]);

  // Step 2: user saved the key — commit to the server. UIA password (if the
  // server asks) is collected lazily via the resolver below.
  const confirmKeySaved = useCallback(async () => {
    const userId = client?.getUserId();
    const key = generatedKeyRef.current;
    if (!client || !userId || !key) return;

    setBusy(true);
    setError(null);
    setPhase("working");
    try {
      await commitEncryptionRecovery(client, key, {
        authUploadDeviceSigningKeys: makePasswordAuthCallback(userId, () => {
          // Server challenged for auth: surface the password field and wait.
          setPhase("password");
          setBusy(false);
          return new Promise<string>((resolve) => {
            passwordResolveRef.current = resolve;
          });
        }),
      });
      generatedKeyRef.current = null;
      setRecoveryKey(null);
      await refresh();
    } catch (e) {
      setPassword("");
      setError(e instanceof Error ? e.message : "Не удалось включить шифрование");
      // Back to the key screen so the user can retry the commit.
      setPhase("show-key");
    } finally {
      setBusy(false);
    }
  }, [client, refresh]);

  // Resolve the pending UIA prompt with the typed password.
  const submitPassword = useCallback(() => {
    const resolve = passwordResolveRef.current;
    if (!resolve || !password) return;
    passwordResolveRef.current = null;
    setPhase("working");
    setBusy(true);
    resolve(password);
    setPassword("");
  }, [password]);

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
    startSetup,
    confirmKeySaved,
    submitPassword,
    runUnlock,
  };
}
