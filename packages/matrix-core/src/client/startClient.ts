import {
  createClient,
  IndexedDBStore,
  PendingEventOrdering,
  type ICreateClientOpts,
  type MatrixClient,
} from "matrix-js-sdk";
import type { MatrixSession } from "../session/types";
import { createCryptoCallbacks } from "../crypto/secretStorage";

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
    // Lets the Rust crypto stack read/write secret storage without re-prompting
    // for the recovery key on every access.
    cryptoCallbacks: createCryptoCallbacks(),
  };

  const client = createClient(options);
  await store?.startup();
  await client.startClient({ initialSyncLimit: 100, threadSupport: true });
  return client;
}
