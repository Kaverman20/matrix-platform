import type { MatrixClient } from "matrix-js-sdk";

export async function sendTextMessage(
  client: MatrixClient,
  roomId: string,
  text: string,
): Promise<void> {
  const body = text.trim();
  if (!body) return;
  await client.sendTextMessage(roomId, body);
}

