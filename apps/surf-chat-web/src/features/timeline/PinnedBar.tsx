import { Pin } from "lucide-react";
import type { PinnedMessage } from "./usePinnedMessages";

type Props = {
  /** All pinned messages (drives the segment indicator). */
  pinned: PinnedMessage[];
  /** Index of the currently shown pinned message. */
  currentIndex: number;
  /** The currently shown pinned message. */
  current: PinnedMessage;
};

/** Inner content of the pinned-message bar (segments, icon, label + preview).
 * The animated `motion.button` wrapper and the cycle handler stay in ChatShell. */
export function PinnedBar({ pinned, currentIndex, current }: Props) {
  return (
    <>
      {pinned.length > 1 && (
        <div className="pinned-bar__segments">
          {pinned.map((message, index) => (
            <span
              key={message.id}
              className={`pinned-bar__segment${index === currentIndex ? " is-active" : ""}`}
            />
          ))}
        </div>
      )}
      <Pin size={15} className="pinned-bar__icon" />
      <div className="pinned-bar__body">
        <span className="pinned-bar__label">
          Закреплённое{pinned.length > 1 ? ` · ${currentIndex + 1}/${pinned.length}` : ""}
        </span>
        <span className="pinned-bar__text">{current.text ?? "Сообщение"}</span>
      </div>
    </>
  );
}
