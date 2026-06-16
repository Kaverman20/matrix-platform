import type { ICreateClientOpts } from "matrix-js-sdk";

// In-memory cache of secret-storage (4S / "recovery") keys, keyed by the secret
// storage key id. The Rust crypto stack calls `getSecretStorageKey` every time
// it reads from or writes to secret storage (cross-signing keys, backup key,
// new device setup). Answering from this cache means the user enters their
// recovery key at most once per session instead of on every access.
//
// Lives at module scope (one crypto stack per tab). Cleared on logout.
const keyCache = new Map<string, Uint8Array<ArrayBuffer>>();

// A recovery key supplied by the app before its secret-storage key id is known
// (the SDK only reveals the id inside the `getSecretStorageKey` callback). Used
// during unlock: the app primes the decoded key, the SDK then asks for it.
let pendingKey: Uint8Array<ArrayBuffer> | null = null;

/** Prime a decoded recovery key for the next secret-storage access, before the
 * key id is known (used when unlocking with a recovery key on a new device). */
export function primeRecoveryKey(key: Uint8Array<ArrayBuffer>): void {
  pendingKey = key;
}

/** Drop all cached secret-storage keys (call on logout). */
export function clearSecretStorageKeys(): void {
  keyCache.clear();
  pendingKey = null;
}

/**
 * Crypto callbacks to pass to `createClient`. They let the SDK fetch the secret
 * storage key from our cache, and capture newly-created keys into it.
 */
export function createCryptoCallbacks(): ICreateClientOpts["cryptoCallbacks"] {
  return {
    cacheSecretStorageKey: (keyId, _keyInfo, key) => {
      keyCache.set(keyId, key);
    },
    getSecretStorageKey: async ({ keys }) => {
      for (const keyId of Object.keys(keys)) {
        const cached = keyCache.get(keyId);
        if (cached) return [keyId, cached];
      }
      if (pendingKey) {
        // Bind the primed key to whichever key id the SDK is asking for, and
        // promote it into the cache so later accesses don't need re-priming.
        const [keyId] = Object.keys(keys);
        if (keyId) {
          keyCache.set(keyId, pendingKey);
          const key = pendingKey;
          pendingKey = null;
          return [keyId, key];
        }
      }
      return null;
    },
  };
}
