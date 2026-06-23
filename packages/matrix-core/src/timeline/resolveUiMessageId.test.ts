import { describe, expect, it } from "vitest";
import { resolveUiMessageId } from "./pagination";
import type { MatrixMessage } from "./messageTypes";

const msg = (over: Partial<MatrixMessage>): MatrixMessage => ({
  id: "x",
  sender: "@a:s",
  author: "A",
  time: "12:00",
  timestamp: 0,
  text: "",
  color: "#000",
  own: false,
  edited: false,
  reactions: [],
  ...over,
});

describe("resolveUiMessageId", () => {
  const messages = [
    msg({ id: "$text1" }),
    msg({ id: "$albumLast", albumEventIds: ["$a1", "$a2", "$albumLast"] }),
    msg({ id: "$text2" }),
  ];

  it("прямое совпадение по id строки", () => {
    expect(resolveUiMessageId(messages, "$text1")).toBe("$text1");
    expect(resolveUiMessageId(messages, "$text2")).toBe("$text2");
  });

  it("event — член альбома → возвращает id строки альбома", () => {
    expect(resolveUiMessageId(messages, "$a1")).toBe("$albumLast");
    expect(resolveUiMessageId(messages, "$a2")).toBe("$albumLast");
    expect(resolveUiMessageId(messages, "$albumLast")).toBe("$albumLast");
  });

  it("неизвестный event → null", () => {
    expect(resolveUiMessageId(messages, "$nope")).toBeNull();
  });
});
