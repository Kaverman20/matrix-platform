import { MessagesSquare, X } from "lucide-react";
import { useMatrix } from "../../app/providers/MatrixContext";
import { useRoomThreads } from "./useRoomThreads";
import "./thread-panel.css";

type Props = {
  roomId: string;
  onSelect: (rootId: string) => void;
  onClose: () => void;
};

export function ThreadsListPanel({ roomId, onSelect, onClose }: Props) {
  const { client } = useMatrix();
  const threads = useRoomThreads(client, roomId);

  return (
    <aside className="thread-panel">
      <header className="thread-panel__header">
        <div className="thread-panel__title">
          <MessagesSquare size={18} />
          <span>Треды</span>
        </div>
        <button type="button" className="icon-button" title="Закрыть" onClick={onClose}>
          <X size={18} />
        </button>
      </header>

      <div className="threads-list">
        {threads.length === 0 ? (
          <div className="threads-list__empty">В этом канале пока нет тредов.</div>
        ) : (
          threads.map((thread) => (
            <button
              key={thread.rootId}
              type="button"
              className={`threads-list__item${thread.unread ? " threads-list__item--unread" : ""}`}
              onClick={() => onSelect(thread.rootId)}
            >
              <div className="threads-list__head">
                <strong>{thread.rootAuthor}</strong>
                {thread.unread && <span className="threads-list__dot" />}
              </div>
              <div className="threads-list__preview">{thread.rootText}</div>
              <div className="threads-list__meta">
                {repliesLabel(thread.replyCount)}
                {thread.lastAuthor ? ` · последний: ${thread.lastAuthor}` : ""}
              </div>
            </button>
          ))
        )}
      </div>
    </aside>
  );
}

function repliesLabel(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} ответ`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} ответа`;
  return `${count} ответов`;
}
