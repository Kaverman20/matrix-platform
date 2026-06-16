import type { MatrixClient, UIAuthCallback } from "matrix-js-sdk";
import { decodeRecoveryKey, type GeneratedSecretStorageKey } from "matrix-js-sdk/lib/crypto-api";
import { primeRecoveryKey } from "./secretStorage";

export type { GeneratedSecretStorageKey };

// Per-client in-flight guard. Module-global state would break a second account
// logging in within the same tab (the flag would stay set and skip init for the
// new client), so we key on the client instance instead.
const initInFlight = new WeakMap<MatrixClient, Promise<void>>();

/**
 * Initialise E2EE (Rust crypto) so encrypted rooms can be decrypted. Loads a
 * multi-MB wasm module and does CPU work, so keep it OFF the login critical
 * path — call it lazily/in the background once the UI is interactive. Idempotent
 * per client.
 *
 * The rust crypto store is namespaced per `userId|deviceId`. Without this all
 * accounts on the same origin would share one IndexedDB, and logging in as a
 * different user than last time throws "the account in the store doesn't match".
 */
export async function enableEncryption(client: MatrixClient): Promise<void> {
  if (client.getCrypto()) return;

  const existing = initInFlight.get(client);
  if (existing) return existing;

  const userId = client.getUserId() ?? undefined;
  const deviceId = client.getDeviceId() ?? undefined;

  const promise = client.initRustCrypto({
    useIndexedDB: true,
    cryptoDatabasePrefix: userId && deviceId ? `${userId}|${deviceId}` : undefined,
  });
  initInFlight.set(client, promise);

  try {
    await promise;
  } catch (error) {
    initInFlight.delete(client);
    console.error("[matrix-core] enableEncryption failed", error);
    throw error;
  }
}

export type EncryptionStatus = {
  /** Rust crypto is initialised on this client. */
  cryptoEnabled: boolean;
  /** Cross-signing is set up and trusted by this device. */
  crossSigningReady: boolean;
  /** Secret storage (4S) holds the cross-signing + backup keys. */
  secretStorageReady: boolean;
  /** Active server-side key backup version, or null if none. */
  keyBackupVersion: string | null;
  /** A default secret-storage key exists on the account (i.e. recovery was set
   * up on some device). Distinguishes "set up encryption" from "enter key". */
  recoveryExists: boolean;
};

const DISABLED: EncryptionStatus = {
  cryptoEnabled: false,
  crossSigningReady: false,
  secretStorageReady: false,
  keyBackupVersion: null,
  recoveryExists: false,
};

/** Snapshot of where this device stands re: cross-signing, secret storage and
 * key backup. Drives the "set up encryption" vs "enter recovery key" vs "ready"
 * decision in the UI. */
export async function getEncryptionStatus(client: MatrixClient): Promise<EncryptionStatus> {
  const crypto = client.getCrypto();
  if (!crypto) return DISABLED;

  const [crossSigningReady, secretStorageReady, keyBackupVersion, defaultKeyId] = await Promise.all([
    crypto.isCrossSigningReady(),
    crypto.isSecretStorageReady(),
    crypto.getActiveSessionBackupVersion(),
    client.secretStorage?.getDefaultKeyId?.() ?? Promise.resolve(null),
  ]);

  return {
    cryptoEnabled: true,
    crossSigningReady,
    secretStorageReady,
    keyBackupVersion,
    recoveryExists: defaultKeyId !== null,
  };
}

export type RecoverySetupOptions = {
  /** Collects User-Interactive Auth for uploading the cross-signing keys (e.g.
   * the account password). Required by most homeservers for this operation. */
  authUploadDeviceSigningKeys?: UIAuthCallback<void>;
};

/**
 * Step 1 of first-time setup, Element-style: generate a fresh random recovery
 * key locally. No network, no auth — so it can be shown to the user *before*
 * anything is committed to the server. Keep the returned object and pass it to
 * {@link commitEncryptionRecovery}; `encodedPrivateKey` is what the user saves.
 */
export async function generateRecoveryKey(client: MatrixClient): Promise<GeneratedSecretStorageKey> {
  const crypto = client.getCrypto();
  if (!crypto) throw new Error("[matrix-core] enable encryption before setting up recovery");

  // Random key (not passphrase-derived) — the spec-recommended approach.
  const recoveryKey = await crypto.createRecoveryKeyFromPassphrase();
  if (!recoveryKey.encodedPrivateKey) {
    throw new Error("[matrix-core] recovery key was not generated");
  }
  return recoveryKey;
}

/**
 * Step 2 of first-time setup: bootstrap cross-signing, secret storage and a
 * server-side key backup using the key from {@link generateRecoveryKey}. This
 * is where the server is touched — cross-signing key upload may trigger UIA,
 * which is why the password is collected here (via `authUploadDeviceSigningKeys`)
 * and not before. Mirrors Element's "show the key first, verify last" order.
 */
export async function commitEncryptionRecovery(
  client: MatrixClient,
  recoveryKey: GeneratedSecretStorageKey,
  options: RecoverySetupOptions = {},
): Promise<void> {
  const crypto = client.getCrypto();
  if (!crypto) throw new Error("[matrix-core] enable encryption before setting up recovery");

  await crypto.bootstrapCrossSigning({
    setupNewCrossSigning: true,
    authUploadDeviceSigningKeys: options.authUploadDeviceSigningKeys,
  });

  await crypto.bootstrapSecretStorage({
    setupNewSecretStorage: true,
    setupNewKeyBackup: true,
    createSecretStorageKey: async () => recoveryKey,
  });
}

/**
 * Unlock encryption on a new device / re-login using the recovery key: decode
 * it, hand it to the SDK's secret-storage callback, cross-sign this device, and
 * restore message history from the key backup. Throws on a malformed or wrong
 * key.
 */
export async function restoreEncryptionWithRecoveryKey(
  client: MatrixClient,
  encodedRecoveryKey: string,
  options: RecoverySetupOptions = {},
): Promise<void> {
  const crypto = client.getCrypto();
  if (!crypto) throw new Error("[matrix-core] enable encryption before restoring");

  // Throws on malformed input — surfaced to the caller as "invalid key".
  const privateKey = decodeRecoveryKey(encodedRecoveryKey.trim());
  primeRecoveryKey(privateKey);

  // Signs this device using the cross-signing keys pulled from secret storage.
  await crypto.bootstrapCrossSigning({
    authUploadDeviceSigningKeys: options.authUploadDeviceSigningKeys,
  });

  // Pull the backup decryption key out of secret storage, then restore history.
  await crypto.loadSessionBackupPrivateKeyFromSecretStorage();
  await crypto.restoreKeyBackup();
}
