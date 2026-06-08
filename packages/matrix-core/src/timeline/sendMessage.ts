import { EventType, MsgType, RelationType, type MatrixClient } from "matrix-js-sdk";
import type {
  MatrixForwardData,
  MatrixMessage,
  MatrixMessageReference,
} from "./messageTypes";

export const FORWARD_KEY = "ru.surfchat.forwarded";

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

export function buildForwardData(
  client: MatrixClient,
  roomId: string,
  message: MatrixMessage,
): MatrixForwardData {
  const sourceEvent = client.getRoom(roomId)?.findEventById(message.id);
  const sourceContent: unknown = sourceEvent?.getContent();
  const content: Record<string, unknown> = isRecord(sourceContent)
    ? { ...sourceContent }
    : { msgtype: MsgType.Text, body: message.text };

  delete content["m.relates_to"];
  delete content["m.new_content"];

  return {
    content,
    author: message.author,
    sender: message.sender,
    preview: message.text || "Сообщение",
  };
}

export async function sendForwardedMessage(
  client: MatrixClient,
  roomId: string,
  data: MatrixForwardData,
): Promise<void> {
  const content = {
    ...data.content,
    [FORWARD_KEY]: {
      author: data.author,
      sender: data.sender,
    },
  };

  await client.sendEvent(roomId, EventType.RoomMessage, content as never);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
