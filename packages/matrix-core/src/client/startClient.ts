import {
  createClient,
  IndexedDBStore,
  PendingEventOrdering,
  type ICreateClientOpts,
  type MatrixClient,
} from "matrix-js-sdk";
import type { MatrixSession } from "../session/types";

type SurfCreateClientOptions = ICreateClientOpts & {
  pendingEventOrdering?: PendingEventOrdering;
};

function createTimelineStore(session: MatrixSession): IndexedDBStore | undefined {
  if (typeof indexedDB === "undefined" || typeof localStorage === "undefined") return undefined;

  const dbKey = encodeURIComponent(`${session.baseUrl}:${session.userId}:${session.deviceId}`);
  return new IndexedDBStore({
    indexedDB,
    localStorage,
    dbName: `surf-chat:matrix:${dbKey}`,
  });
}

export async function startMatrixClient(
  session: MatrixSession,
): Promise<MatrixClient> {
  const store = createTimelineStore(session);
  const options: SurfCreateClientOptions = {
    baseUrl: session.baseUrl,
    accessToken: session.accessToken,
    userId: session.userId,
    deviceId: session.deviceId,
    store,
    // Chronological keeps local echoes inside the (room + thread) timelines so
    // the sender sees their own message instantly, before the server echoes back.
    pendingEventOrdering: PendingEventOrdering.Chronological,
  };

  const client = createClient(options);
  await store?.startup();
  await client.startClient({ initialSyncLimit: 30, threadSupport: true });
  return client;
}

let encryptionStarted = false;

/**
 * Initialise E2EE (Rust crypto) so encrypted rooms can be decrypted. This loads
 * a multi-MB wasm module and does CPU work, so it is kept OFF the login critical
 * path — call it lazily/in the background once the UI is interactive. Idempotent.
 */
export async function enableEncryption(client: MatrixClient): Promise<void> {
  if (encryptionStarted || client.getCrypto()) return;
  encryptionStarted = true;
  try {
    await client.initRustCrypto({ useIndexedDB: true });
  } catch (error) {
    encryptionStarted = false;
    console.error("[matrix-core] enableEncryption failed", error);
  }
}
