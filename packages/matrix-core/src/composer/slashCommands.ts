export type SlashCommandAction = "help" | "clear";

export type SlashCommandSend = {
  kind: "send";
  body: string;
  msgtype: "m.text" | "m.emote";
  formattedBody?: string;
};

export type SlashCommandResult =
  | SlashCommandSend
  | { kind: "action"; action: SlashCommandAction }
  | null;

const SHRUG = "¯\\_(ツ)_/¯";
const TABLEFLIP = "(╯°□°）╯︵ ┻━┻";
const UNFLIP = "┬─┬ノ( º _ ºノ)";
const LENNY = "( ͡° ͜ʖ ͡°)";

const HELP_TEXT = [
  "/me — действие от вашего имени",
  "/shrug, /tableflip, /unflip, /lenny — текстовые реакции",
  "/clear — очистить черновик",
  "/help — эта подсказка",
].join("\n");

/** Parses a leading slash command. Returns null when the input is plain text. */
export function parseSlashCommand(input: string): SlashCommandResult {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) return null;

  const space = trimmed.indexOf(" ");
  const command = (space === -1 ? trimmed.slice(1) : trimmed.slice(1, space)).toLowerCase();
  const args = space === -1 ? "" : trimmed.slice(space + 1).trim();

  switch (command) {
    case "me":
      if (!args) return null;
      return {
        kind: "send",
        msgtype: "m.emote",
        body: args,
        formattedBody: `* ${escapeHtml(args)}`,
      };
    case "shrug":
      return { kind: "send", msgtype: "m.text", body: args ? `${args} ${SHRUG}` : SHRUG };
    case "tableflip":
      return { kind: "send", msgtype: "m.text", body: args ? `${args} ${TABLEFLIP}` : TABLEFLIP };
    case "unflip":
      return { kind: "send", msgtype: "m.text", body: args ? `${args} ${UNFLIP}` : UNFLIP };
    case "lenny":
      return { kind: "send", msgtype: "m.text", body: args ? `${args} ${LENNY}` : LENNY };
    case "clear":
      return { kind: "action", action: "clear" };
    case "help":
      return { kind: "action", action: "help" };
    default:
      return null;
  }
}

export function slashCommandHelpText(): string {
  return HELP_TEXT;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
