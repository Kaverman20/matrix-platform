import { EventType, MsgType, RelationType, type MatrixClient } from "matrix-js-sdk";
import type {
  MatrixForwardData,
  MatrixMessage,
  MatrixMessageReference,
} from "./messageTypes";

export const FORWARD_KEY = "ru.surfchat.forwarded";

export type MediaUploadInfo = {
  height?: number;
  width?: number;
};

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

export async function sendMediaMessage(
  client: MatrixClient,
  roomId: string,
  file: File,
  uploadInfo: MediaUploadInfo = {},
): Promise<void> {
  const upload = await client.uploadContent(file, {
    name: file.name,
    type: file.type || "application/octet-stream",
  });
  const contentUri = upload.content_uri;
  const msgtype = msgTypeForFile(file);

  await client.sendEvent(roomId, EventType.RoomMessage, {
    msgtype,
    body: file.name || "Файл",
    url: contentUri,
    info: {
      mimetype: file.type || "application/octet-stream",
      size: file.size,
      ...(uploadInfo.width ? { w: uploadInfo.width } : {}),
      ...(uploadInfo.height ? { h: uploadInfo.height } : {}),
    },
  } as never);
}

export async function sendReaction(
  client: MatrixClient,
  roomId: string,
  eventId: string,
  key: string,
): Promise<void> {
  await client.sendEvent(roomId, EventType.Reaction, {
    "m.relates_to": {
      rel_type: RelationType.Annotation,
      event_id: eventId,
      key,
    },
  });
}

export async function removeReaction(
  client: MatrixClient,
  roomId: string,
  reactionEventId: string,
): Promise<void> {
  await client.redactEvent(roomId, reactionEventId);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function msgTypeForFile(
  file: File,
): MsgType.Image | MsgType.Video | MsgType.Audio | MsgType.File {
  if (file.type.startsWith("image/")) return MsgType.Image;
  if (file.type.startsWith("video/")) return MsgType.Video;
  if (file.type.startsWith("audio/")) return MsgType.Audio;
  return MsgType.File;
}
