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

  // Rich-reply fallback so clients that don't render m.in_reply_to (older
  // clients, bots) still show the quoted message as a "> " blockquote.
  const fallback = buildReplyFallback(replyTo, body);

  await client.sendEvent(roomId, EventType.RoomMessage, {
    msgtype: MsgType.Text,
    body: fallback.body,
    format: "org.matrix.custom.html",
    formatted_body: fallback.formattedBody,
    "m.relates_to": {
      "m.in_reply_to": {
        event_id: replyTo.id,
      },
    },
  });
}

export function buildReplyFallback(
  replyTo: MatrixMessageReference,
  body: string,
): { body: string; formattedBody: string } {
  const quotedText = (replyTo.text ?? "").trim();
  const sender = replyTo.sender ?? "";
  const quotedLines = quotedText
    ? quotedText.split("\n").map((line) => `> ${line}`).join("\n")
    : "";
  const plainBody = sender
    ? `> <${sender}>${quotedText ? ` ${quotedText}` : ""}\n\n${body}`
    : quotedLines
      ? `${quotedLines}\n\n${body}`
      : body;

  const link = sender
    ? `<a href="https://matrix.to/#/${encodeURIComponent(sender)}">${escapeHtml(
        replyTo.author ?? sender,
      )}</a>`
    : escapeHtml(replyTo.author ?? "");
  const formattedBody =
    `<mx-reply><blockquote>${link}<br>${escapeHtml(quotedText)}</blockquote></mx-reply>` +
    escapeHtml(body);

  return { body: plainBody, formattedBody };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
  threadRootId?: string,
): Promise<void> {
  const upload = await client.uploadContent(file, {
    name: file.name,
    type: file.type || "application/octet-stream",
  });
  const contentUri = upload.content_uri;
  const msgtype = msgTypeForFile(file);
  const thread = client.getRoom(roomId)?.getThread(threadRootId ?? "");

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
    ...(threadRootId
      ? {
          "m.relates_to": {
            rel_type: RelationType.Thread,
            event_id: threadRootId,
            is_falling_back: true,
            "m.in_reply_to": { event_id: thread?.lastReply()?.getId() ?? threadRootId },
          },
        }
      : {}),
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
