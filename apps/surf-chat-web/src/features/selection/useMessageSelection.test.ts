import { describe, expect, it } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { MatrixMessage } from "@matrix-platform/matrix-core";
import { isSelectableMessage, useMessageSelection } from "./useMessageSelection";

function message(id: string, overrides: Partial<MatrixMessage> = {}): MatrixMessage {
  return {
    id,
    kind: "message",
    text: "hi",
    timestamp: 1,
    sender: "@a:hs",
    author: "A",
    color: "#000",
    own: false,
    reactions: [],
    ...overrides,
  } as MatrixMessage;
}

describe("isSelectableMessage", () => {
  it("skips system and deleted messages", () => {
    expect(isSelectableMessage(message("$1"))).toBe(true);
    expect(isSelectableMessage(message("$2", { kind: "system" }))).toBe(false);
    expect(isSelectableMessage(message("$3", { deleted: true }))).toBe(false);
  });
});

describe("useMessageSelection", () => {
  it("enters selection mode and toggles ids", () => {
    const messages = [message("$1"), message("$2")];
    const { result } = renderHook(() => useMessageSelection(messages));

    act(() => {
      result.current.enter();
      result.current.toggle("$1");
    });

    expect(result.current.active).toBe(true);
    expect(result.current.selectedIds).toEqual(["$1"]);

    act(() => {
      result.current.toggle("$1");
    });

    expect(result.current.selectedIds).toEqual([]);
  });

  it("extends selection with shift range", () => {
    const messages = [message("$1"), message("$2"), message("$3")];
    const { result } = renderHook(() => useMessageSelection(messages));

    act(() => {
      result.current.enter();
      result.current.toggle("$1");
    });

    act(() => {
      result.current.handleClick(messages[2]!, { shiftKey: true, metaKey: false, ctrlKey: false });
    });

    expect(result.current.selectedIds.sort()).toEqual(["$1", "$2", "$3"].sort());
  });
});
