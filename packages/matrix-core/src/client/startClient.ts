import {
  createClient,
  PendingEventOrdering,
  type ICreateClientOpts,
  type MatrixClient,
} from "matrix-js-sdk";
import type { MatrixSession } from "../session/types";

type SurfCreateClientOptions = ICreateClientOpts & {
  pendingEventOrdering?: PendingEventOrdering;
};

export async function startMatrixClient(
  session: MatrixSession,
): Promise<MatrixClient> {
  const options: SurfCreateClientOptions = {
    baseUrl: session.baseUrl,
    accessToken: session.accessToken,
    userId: session.userId,
    deviceId: session.deviceId,
    pendingEventOrdering: PendingEventOrdering.Detached,
  };

  const client = createClient(options);
  await client.startClient({ initialSyncLimit: 30, threadSupport: true });
  return client;
}

