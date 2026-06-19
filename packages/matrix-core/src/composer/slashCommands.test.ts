import { describe, expect, it } from "vitest";
import { parseSlashCommand } from "./slashCommands";

describe("slashCommands", () => {
  it("parses /me as emote", () => {
    expect(parseSlashCommand("/me waves")).toMatchObject({
      kind: "send",
      msgtype: "m.emote",
      body: "waves",
    });
  });

  it("parses shrug shortcuts", () => {
    expect(parseSlashCommand("/shrug")).toMatchObject({
      kind: "send",
      body: "¯\\_(ツ)_/¯",
    });
  });

  it("returns action commands", () => {
    expect(parseSlashCommand("/clear")).toEqual({ kind: "action", action: "clear" });
    expect(parseSlashCommand("/help")).toEqual({ kind: "action", action: "help" });
  });

  it("returns null for plain text", () => {
    expect(parseSlashCommand("hello")).toBeNull();
  });
});
