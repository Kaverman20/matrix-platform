import type { KeyboardEvent } from "react";

/** Shared Enter-to-send behaviour for the message composers.
 *
 * - enterToSend:  Enter sends, Shift+Enter inserts a newline.
 * - !enterToSend: Enter inserts a newline, Ctrl/Cmd+Enter sends.
 *
 * Calls `submit()` and prevents default when the combo means "send".
 */
export function composerSubmitOnKeyDown(
  event: KeyboardEvent,
  { enterToSend, submit }: { enterToSend: boolean; submit: () => void },
) {
  if (event.key !== "Enter") return;

  const send = enterToSend
    ? !event.shiftKey && !event.ctrlKey && !event.metaKey
    : event.ctrlKey || event.metaKey;

  if (send) {
    event.preventDefault();
    submit();
  }
}
