import { afterEach, describe, expect, it } from "vitest";
import {
  clearSecretStorageKeys,
  createCryptoCallbacks,
  primeRecoveryKey,
} from "./secretStorage";

type Callbacks = NonNullable<ReturnType<typeof createCryptoCallbacks>>;

function keysArg(keyId: string) {
  return { keys: { [keyId]: {} as never } };
}

afterEach(() => {
  clearSecretStorageKeys();
});

describe("createCryptoCallbacks", () => {
  it("returns null when no key is cached or primed", async () => {
    const cb = createCryptoCallbacks() as Callbacks;
    await expect(cb.getSecretStorageKey!(keysArg("k1"), "m.cross_signing.master")).resolves.toBeNull();
  });

  it("returns a cached key for the requested key id", async () => {
    const cb = createCryptoCallbacks() as Callbacks;
    const key = new Uint8Array([1, 2, 3]);
    cb.cacheSecretStorageKey!("k1", {} as never, key);

    const result = await cb.getSecretStorageKey!(keysArg("k1"), "m.megolm_backup.v1");
    expect(result).toEqual(["k1", key]);
  });

  it("does not return a cached key for a different key id", async () => {
    const cb = createCryptoCallbacks() as Callbacks;
    cb.cacheSecretStorageKey!("k1", {} as never, new Uint8Array([9]));
    await expect(cb.getSecretStorageKey!(keysArg("other"), "x")).resolves.toBeNull();
  });

  it("binds a primed recovery key to whichever key id the SDK asks for", async () => {
    const cb = createCryptoCallbacks() as Callbacks;
    const key = new Uint8Array([4, 5, 6]);
    primeRecoveryKey(key);

    const result = await cb.getSecretStorageKey!(keysArg("default"), "m.cross_signing.self_signing");
    expect(result).toEqual(["default", key]);
  });

  it("promotes a primed key into the cache and consumes the pending slot", async () => {
    const cb = createCryptoCallbacks() as Callbacks;
    const key = new Uint8Array([7]);
    primeRecoveryKey(key);

    // First access binds + caches under the asked id.
    await cb.getSecretStorageKey!(keysArg("kX"), "a");
    // Same id is now served from cache.
    await expect(cb.getSecretStorageKey!(keysArg("kX"), "b")).resolves.toEqual(["kX", key]);
    // A different id is not served (pending was one-shot, already consumed).
    await expect(cb.getSecretStorageKey!(keysArg("kY"), "c")).resolves.toBeNull();
  });

  it("clearSecretStorageKeys drops cached and pending keys", async () => {
    const cb = createCryptoCallbacks() as Callbacks;
    cb.cacheSecretStorageKey!("k1", {} as never, new Uint8Array([1]));
    primeRecoveryKey(new Uint8Array([2]));
    clearSecretStorageKeys();

    await expect(cb.getSecretStorageKey!(keysArg("k1"), "x")).resolves.toBeNull();
  });
});
