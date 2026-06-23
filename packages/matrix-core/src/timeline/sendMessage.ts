import { EventType, MsgType, RelationType, type MatrixClient } from "matrix-js-sdk";
import type { MatrixMentionMember } from "../composer/mentions";
import { prepareOutgoingMessage } from "../composer/prepareOutgoingMessage";
import { escapeHtml } from "../util/escapeHtml";
import type {
  MatrixForwardData,
  MatrixMessage,
  MatrixMessageReference,
} from "./messageTypes";

export const FORWARD_KEY = "ru.surfchat.forwarded";
// Кастомное поле для группировки нескольких медиа в один «альбом» (пак как в
// Telegram). Matrix не имеет нативной группировки, поэтому метим события общим id.
export const ALBUM_KEY = "ru.surfchat.album";

export type MediaAlbumInfo = {
  id: string;
  index: number;
  total: number;
};

export type MediaUploadInfo = {
  height?: number;
  width?: number;
};

export type SendTextMessageOptions = {
  members?: readonly MatrixMentionMember[];
};

export async function sendTextMessage(
  client: MatrixClient,
  roomId: string,
  text: string,
  options: SendTextMessageOptions = {},
): Promise<"sent" | "help" | "clear" | "ignored"> {
  const prepared = prepareOutgoingMessage(text, options.members);
  if (!prepared) return "ignored";
  if (prepared.kind === "action") return prepared.action;
  await client.sendEvent(roomId, EventType.RoomMessage, prepared.content as never);
  return "sent";
}

export async function sendReplyMessage(
  client: MatrixClient,
  roomId: string,
  text: string,
  replyTo: MatrixMessageReference,
  options: SendTextMessageOptions = {},
): Promise<"sent" | "help" | "clear" | "ignored"> {
  const prepared = prepareOutgoingMessage(text, options.members);
  if (!prepared) return "ignored";
  if (prepared.kind === "action") return prepared.action;

  const body = prepared.content.body;

  // Rich-reply fallback so clients that don't render m.in_reply_to (older
  // clients, bots) still show the quoted message as a "> " blockquote.
  const fallback = buildReplyFallback(replyTo, body);
  const formattedBody = prepared.content.formatted_body
    ? `<mx-reply><blockquote>${extractReplyQuoteHtml(fallback.formattedBody)}</blockquote></mx-reply>${prepared.content.formatted_body}`
    : fallback.formattedBody;

  await client.sendEvent(roomId, EventType.RoomMessage, {
    ...prepared.content,
    body: fallback.body,
    format: "org.matrix.custom.html",
    formatted_body: formattedBody,
    "m.relates_to": {
      "m.in_reply_to": {
        event_id: replyTo.id,
      },
    },
  });
  return "sent";
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

function extractReplyQuoteHtml(formattedBody: string): string {
  const match = formattedBody.match(/^<mx-reply><blockquote>([\s\S]*?)<\/blockquote><\/mx-reply>/);
  return match?.[1] ?? formattedBody;
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

export function buildForwardDataList(
  client: MatrixClient,
  roomId: string,
  messages: MatrixMessage[],
): MatrixForwardData[] {
  return messages.map((message) => buildForwardData(client, roomId, message));
}

export async function deleteMessages(
  client: MatrixClient,
  roomId: string,
  eventIds: string[],
): Promise<void> {
  for (const eventId of eventIds) {
    await deleteMessage(client, roomId, eventId);
  }
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
  options: {
    voice?: boolean;
    durationMs?: number;
    waveform?: number[];
    caption?: string;
    asFile?: boolean;
    album?: MediaAlbumInfo;
  } = {},
): Promise<void> {
  const upload = await client.uploadContent(file, {
    name: file.name,
    type: file.type || "application/octet-stream",
  });
  const contentUri = upload.content_uri;
  // `asFile` принудительно отправляет вложение как документ (оригинал, без
  // показа в виде картинки/видео) — это режим «Файл» из меню скрепки и DnD.
  const msgtype = options.voice
    ? MsgType.Audio
    : options.asFile
      ? MsgType.File
      : msgTypeForFile(file);
  const thread = client.getRoom(roomId)?.getThread(threadRootId ?? "");

  const caption = options.caption?.trim();
  await client.sendEvent(roomId, EventType.RoomMessage, {
    msgtype,
    // With a caption, `body` carries the caption text and `filename` keeps the
    // original name (extensible-events / MSC2530 convention). Otherwise `body`
    // is the filename, as before.
    body: options.voice ? "Голосовое сообщение" : caption || file.name || "Файл",
    ...(caption ? { filename: file.name || "Файл" } : {}),
    url: contentUri,
    info: {
      mimetype: file.type || "application/octet-stream",
      size: file.size,
      ...(uploadInfo.width ? { w: uploadInfo.width } : {}),
      ...(uploadInfo.height ? { h: uploadInfo.height } : {}),
      ...(options.durationMs ? { duration: options.durationMs } : {}),
    },
    ...(options.album ? { [ALBUM_KEY]: options.album } : {}),
    ...(options.voice
      ? {
          "org.matrix.msc3245.voice": {},
          "org.matrix.msc1767.audio": {
            duration: options.durationMs ?? 0,
            waveform: options.waveform ?? [],
          },
        }
      : {}),
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

/** Upload and send a recorded voice message. */
export async function sendVoiceMessage(
  client: MatrixClient,
  roomId: string,
  blob: Blob,
  durationMs: number,
  threadRootId?: string,
  waveform?: number[],
): Promise<void> {
  const type = blob.type || "audio/webm";
  const extension = type.includes("ogg") ? "ogg" : "webm";
  const file = new File([blob], `voice.${extension}`, { type });
  await sendMediaMessage(client, roomId, file, {}, threadRootId, {
    voice: true,
    durationMs,
    waveform,
  });
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

/** Redacts (deletes) a message event from the room. */
export async function deleteMessage(
  client: MatrixClient,
  roomId: string,
  eventId: string,
): Promise<void> {
  await client.redactEvent(roomId, eventId);
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
