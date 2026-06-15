import { ChevronRight, MessagesSquare, X } from "lucide-react";
import { useMatrix } from "../../app/providers/MatrixContext";
import { useAllThreads } from "./useAllThreads";
import "./thread-panel.css";

type Props = {
  open: boolean;
  onSelect: (roomId: string, rootId: string) => void;
  onClose: () => void;
};

export function GlobalThreadsPanel({ open, onSelect, onClose }: Props) {
  const { client } = useMatrix();
  const threads = useAllThreads(client, open);

  if (!open) return null;

  return (
    <div className="gthreads" onMouseDown={onClose}>
      <div className="gthreads__card" onMouseDown={(event) => event.stopPropagation()}>
        <header className="thread-panel__header">
          <div className="thread-panel__title">
            <MessagesSquare size={18} />
            <span>Все треды</span>
          </div>
          <button type="button" className="icon-button" title="Закрыть" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="threads-list">
          {threads.length === 0 ? (
            <div className="threads-list__empty">Тредов пока нет ни в одном канале.</div>
          ) : (
            threads.map((thread) => (
              <button
                key={`${thread.roomId}:${thread.rootId}`}
                type="button"
                className={`threads-list__item${thread.unread ? " threads-list__item--unread" : ""}`}
                onClick={() => onSelect(thread.roomId, thread.rootId)}
              >
                <div className="threads-list__head">
                  <strong>{thread.roomName}</strong>
                  {thread.unread && <span className="threads-list__dot" />}
                  <ChevronRight size={15} className="threads-list__go" />
                </div>
                <div className="threads-list__preview">
                  {thread.rootAuthor}: {thread.rootText}
                </div>
                <div className="threads-list__meta">
                  {repliesLabel(thread.replyCount)}
                  {thread.lastAuthor ? ` · последний: ${thread.lastAuthor}` : ""}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function repliesLabel(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} ответ`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} ответа`;
  return `${count} ответов`;
}
