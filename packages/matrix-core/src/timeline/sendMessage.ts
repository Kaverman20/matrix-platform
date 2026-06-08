import { EventType, MsgType, RelationType, type MatrixClient } from "matrix-js-sdk";
import type { MatrixMessageReference } from "./messageTypes";

export async function sendTextMessage(
  client: MatrixClient,
  roomId: string,
  text: string,
): Promise<void> {
  const body = text.trim();
  if (!body) return;
  await client.sendTextMessage(roomId, body);
}

export async function sendReplyMessage(
  client: MatrixClient,
  roomId: string,
  text: string,
  replyTo: MatrixMessageReference,
): Promise<void> {
  const body = text.trim();
  if (!body) return;

  await client.sendEvent(roomId, EventType.RoomMessage, {
    msgtype: MsgType.Text,
    body,
    "m.relates_to": {
      "m.in_reply_to": {
        event_id: replyTo.id,
      },
    },
  });
}

export async function sendEditMessage(
  client: MatrixClient,
  roomId: string,
  text: string,
  eventId: string,
): Promise<void> {
  const body = text.trim();
  if (!body) return;

  await client.sendEvent(roomId, EventType.RoomMessage, {
    msgtype: MsgType.Text,
    body: `* ${body}`,
    "m.new_content": {
      msgtype: MsgType.Text,
      body,
    },
    "m.relates_to": {
      rel_type: RelationType.Replace,
      event_id: eventId,
    },
  });
}
