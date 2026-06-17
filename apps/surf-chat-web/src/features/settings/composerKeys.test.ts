import type { KeyboardEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { composerSubmitOnKeyDown } from "./composerKeys";

type KeyParts = {
  key?: string;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
};

function fakeEvent(parts: KeyParts) {
  return {
    key: parts.key ?? "Enter",
    shiftKey: parts.shiftKey ?? false,
    ctrlKey: parts.ctrlKey ?? false,
    metaKey: parts.metaKey ?? false,
    preventDefault: vi.fn(),
  } as unknown as KeyboardEvent & { preventDefault: ReturnType<typeof vi.fn> };
}

describe("composerSubmitOnKeyDown", () => {
  it("ignores non-Enter keys", () => {
    const submit = vi.fn();
    const event = fakeEvent({ key: "a" });
    composerSubmitOnKeyDown(event, { enterToSend: true, submit });
    expect(submit).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  describe("enterToSend = true", () => {
    it("sends on plain Enter", () => {
      const submit = vi.fn();
      const event = fakeEvent({});
      composerSubmitOnKeyDown(event, { enterToSend: true, submit });
      expect(submit).toHaveBeenCalledOnce();
      expect(event.preventDefault).toHaveBeenCalledOnce();
    });

    it("inserts a newline on Shift+Enter", () => {
      const submit = vi.fn();
      const event = fakeEvent({ shiftKey: true });
      composerSubmitOnKeyDown(event, { enterToSend: true, submit });
      expect(submit).not.toHaveBeenCalled();
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it("does not send on Ctrl/Cmd+Enter", () => {
      const submit = vi.fn();
      composerSubmitOnKeyDown(fakeEvent({ ctrlKey: true }), { enterToSend: true, submit });
      composerSubmitOnKeyDown(fakeEvent({ metaKey: true }), { enterToSend: true, submit });
      expect(submit).not.toHaveBeenCalled();
    });
  });

  describe("enterToSend = false", () => {
    it("inserts a newline on plain Enter", () => {
      const submit = vi.fn();
      const event = fakeEvent({});
      composerSubmitOnKeyDown(event, { enterToSend: false, submit });
      expect(submit).not.toHaveBeenCalled();
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it("sends on Ctrl+Enter and Cmd+Enter", () => {
      const ctrlSubmit = vi.fn();
      composerSubmitOnKeyDown(fakeEvent({ ctrlKey: true }), { enterToSend: false, submit: ctrlSubmit });
      expect(ctrlSubmit).toHaveBeenCalledOnce();

      const metaSubmit = vi.fn();
      composerSubmitOnKeyDown(fakeEvent({ metaKey: true }), { enterToSend: false, submit: metaSubmit });
      expect(metaSubmit).toHaveBeenCalledOnce();
    });
  });
});
