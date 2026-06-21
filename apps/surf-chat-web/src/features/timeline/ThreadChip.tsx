import { MessagesSquare } from "lucide-react";
import type { MatrixMessage } from "@matrix-platform/matrix-core";

export function ThreadChip({
  message,
  onOpenThread,
}: {
  message: MatrixMessage;
  onOpenThread: (rootId: string) => void;
}) {
  const thread = message.thread;
  if (!thread) return null;

  return (
    <button
      type="button"
      className={`thread-chip${thread.unread ? " thread-chip--unread" : ""}`}
      onClick={() => onOpenThread(message.id)}
    >
      <MessagesSquare size={14} />
      <span>{repliesLabel(thread.count)}</span>
      {thread.lastAuthor && <em>· {thread.lastAuthor}</em>}
    </button>
  );
}

function repliesLabel(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} ответ`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} ответа`;
  return `${count} ответов`;
}
