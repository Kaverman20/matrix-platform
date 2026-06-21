import { MsgType } from "matrix-js-sdk";
import { escapeHtml } from "../util/escapeHtml";
import type { MatrixMentionMember } from "./mentions";
import { resolveMentionsForSend } from "./mentions";
import { parseSlashCommand } from "./slashCommands";

export type OutgoingMessageContent = {
  msgtype: typeof MsgType.Text | typeof MsgType.Emote;
  body: string;
  format?: "org.matrix.custom.html";
  formatted_body?: string;
  "m.mentions"?: { user_ids: string[] };
};

export type PrepareOutgoingMessageResult =
  | { kind: "send"; content: OutgoingMessageContent }
  | { kind: "action"; action: "help" | "clear" }
  | null;

export function prepareOutgoingMessage(
  rawText: string,
  members: readonly MatrixMentionMember[] = [],
): PrepareOutgoingMessageResult {
  const trimmed = rawText.trim();
  if (!trimmed) return null;

  const slash = parseSlashCommand(trimmed);
  if (slash?.kind === "action") {
    return { kind: "action", action: slash.action };
  }

  if (slash?.kind === "send") {
    const content: OutgoingMessageContent = {
      msgtype: slash.msgtype === "m.emote" ? MsgType.Emote : MsgType.Text,
      body: slash.msgtype === "m.emote" ? `* ${slash.body}` : slash.body,
    };
    if (slash.formattedBody) {
      content.format = "org.matrix.custom.html";
      content.formatted_body = slash.formattedBody;
    }
    return { kind: "send", content };
  }

  const resolved = resolveMentionsForSend(trimmed, members);
  const content: OutgoingMessageContent = {
    msgtype: MsgType.Text,
    body: resolved.body,
  };

  if (resolved.userIds.length > 0) {
    content["m.mentions"] = { user_ids: resolved.userIds };
  }
  if (resolved.formattedBody !== escapeHtml(trimmed)) {
    content.format = "org.matrix.custom.html";
    content.formatted_body = resolved.formattedBody;
  }

  return { kind: "send", content };
}
