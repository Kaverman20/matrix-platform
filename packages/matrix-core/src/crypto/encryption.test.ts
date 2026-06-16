import { describe, expect, it, vi } from "vitest";
import type { MatrixClient } from "matrix-js-sdk";
import { encodeRecoveryKey } from "matrix-js-sdk/lib/crypto-api";
import {
  commitEncryptionRecovery,
  enableEncryption,
  generateRecoveryKey,
  getEncryptionStatus,
  restoreEncryptionWithRecoveryKey,
} from "./encryption";
import { clearSecretStorageKeys } from "./secretStorage";

function fakeCrypto(overrides: Record<string, unknown> = {}) {
  return {
    isCrossSigningReady: vi.fn().mockResolvedValue(true),
    isSecretStorageReady: vi.fn().mockResolvedValue(true),
    getActiveSessionBackupVersion: vi.fn().mockResolvedValue("1"),
    createRecoveryKeyFromPassphrase: vi
      .fn()
      .mockResolvedValue({ encodedPrivateKey: "EsT? key", privateKey: new Uint8Array(32) }),
    bootstrapCrossSigning: vi.fn().mockResolvedValue(undefined),
    bootstrapSecretStorage: vi.fn().mockResolvedValue(undefined),
    loadSessionBackupPrivateKeyFromSecretStorage: vi.fn().mockResolvedValue(undefined),
    restoreKeyBackup: vi.fn().mockResolvedValue({ imported: 0, total: 0 }),
    ...overrides,
  };
}

function clientWith(crypto: unknown, defaultKeyId: string | null = null): MatrixClient {
  return {
    getCrypto: () => crypto,
    secretStorage: { getDefaultKeyId: () => Promise.resolve(defaultKeyId) },
  } as unknown as MatrixClient;
}

describe("enableEncryption", () => {
  it("namespaces the rust crypto store per user+device and skips when already enabled", async () => {
    const initRustCrypto = vi.fn().mockResolvedValue(undefined);
    let crypto: unknown = undefined;
    const client = {
      getCrypto: () => crypto,
      getUserId: () => "@f.foxhound:matrix.foxhound.run",
      getDeviceId: () => "ABCD",
      initRustCrypto,
    } as unknown as MatrixClient;

    await enableEncryption(client);
    expect(initRustCrypto).toHaveBeenCalledWith({
      useIndexedDB: true,
      cryptoDatabasePrefix: "@f.foxhound:matrix.foxhound.run|ABCD",
    });

    // Once crypto exists, a second call must be a no-op (no re-init).
    crypto = {};
    await enableEncryption(client);
    expect(initRustCrypto).toHaveBeenCalledTimes(1);
  });
});

describe("getEncryptionStatus", () => {
  it("reports disabled when crypto is not initialised", async () => {
    const status = await getEncryptionStatus(clientWith(undefined));
    expect(status).toEqual({
      cryptoEnabled: false,
      crossSigningReady: false,
      secretStorageReady: false,
      keyBackupVersion: null,
      recoveryExists: false,
    });
  });

  it("aggregates cross-signing, secret storage and backup state", async () => {
    const crypto = fakeCrypto({
      isCrossSigningReady: vi.fn().mockResolvedValue(true),
      isSecretStorageReady: vi.fn().mockResolvedValue(false),
      getActiveSessionBackupVersion: vi.fn().mockResolvedValue("7"),
    });
    const status = await getEncryptionStatus(clientWith(crypto, "key-id"));
    expect(status).toEqual({
      cryptoEnabled: true,
      crossSigningReady: true,
      secretStorageReady: false,
      keyBackupVersion: "7",
      recoveryExists: true,
    });
  });

  it("reports recoveryExists false when no default secret-storage key", async () => {
    const status = await getEncryptionStatus(clientWith(fakeCrypto(), null));
    expect(status.recoveryExists).toBe(false);
  });
});

describe("generateRecoveryKey", () => {
  it("throws when crypto is not enabled", async () => {
    await expect(generateRecoveryKey(clientWith(undefined))).rejects.toThrow(/enable encryption/);
  });

  it("returns the freshly generated key without touching the server", async () => {
    const crypto = fakeCrypto();
    const key = await generateRecoveryKey(clientWith(crypto));
    expect(key.encodedPrivateKey).toBe("EsT? key");
    // Generation is purely local — nothing is bootstrapped yet.
    expect(crypto.bootstrapCrossSigning).not.toHaveBeenCalled();
    expect(crypto.bootstrapSecretStorage).not.toHaveBeenCalled();
  });

  it("throws when no recovery key was produced", async () => {
    const crypto = fakeCrypto({
      createRecoveryKeyFromPassphrase: vi.fn().mockResolvedValue({ encodedPrivateKey: undefined }),
    });
    await expect(generateRecoveryKey(clientWith(crypto))).rejects.toThrow(/not generated/);
  });
});

describe("commitEncryptionRecovery", () => {
  const recoveryKey = { encodedPrivateKey: "EsT? key", privateKey: new Uint8Array(32) };

  it("throws when crypto is not enabled", async () => {
    await expect(
      commitEncryptionRecovery(clientWith(undefined), recoveryKey),
    ).rejects.toThrow(/enable encryption/);
  });

  it("bootstraps cross-signing then secret storage with the supplied key", async () => {
    const crypto = fakeCrypto();
    const auth = vi.fn();

    await commitEncryptionRecovery(clientWith(crypto), recoveryKey, {
      authUploadDeviceSigningKeys: auth,
    });

    expect(crypto.bootstrapCrossSigning).toHaveBeenCalledWith({
      setupNewCrossSigning: true,
      authUploadDeviceSigningKeys: auth,
    });
    expect(crypto.bootstrapSecretStorage).toHaveBeenCalledWith(
      expect.objectContaining({ setupNewSecretStorage: true, setupNewKeyBackup: true }),
    );
    // Cross-signing must be set up before secret storage stores its keys.
    expect(crypto.bootstrapCrossSigning.mock.invocationCallOrder[0]).toBeLessThan(
      crypto.bootstrapSecretStorage.mock.invocationCallOrder[0],
    );

    const opts = crypto.bootstrapSecretStorage.mock.calls[0][0];
    await expect(opts.createSecretStorageKey()).resolves.toBe(recoveryKey);
  });
});

describe("restoreEncryptionWithRecoveryKey", () => {
  const validKey = encodeRecoveryKey(new Uint8Array(32))!;

  it("throws when crypto is not enabled", async () => {
    await expect(
      restoreEncryptionWithRecoveryKey(clientWith(undefined), validKey),
    ).rejects.toThrow(/enable encryption/);
  });

  it("cross-signs this device and restores the key backup", async () => {
    clearSecretStorageKeys();
    const crypto = fakeCrypto();

    await restoreEncryptionWithRecoveryKey(clientWith(crypto), validKey);

    expect(crypto.bootstrapCrossSigning).toHaveBeenCalledTimes(1);
    expect(crypto.loadSessionBackupPrivateKeyFromSecretStorage).toHaveBeenCalledTimes(1);
    expect(crypto.restoreKeyBackup).toHaveBeenCalledTimes(1);
  });

  it("rejects a malformed recovery key without touching the backup", async () => {
    const crypto = fakeCrypto();
    await expect(
      restoreEncryptionWithRecoveryKey(clientWith(crypto), "not-a-real-key"),
    ).rejects.toThrow();
    expect(crypto.restoreKeyBackup).not.toHaveBeenCalled();
  });
});
