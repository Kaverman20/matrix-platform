import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ArrowUp, MessagesSquare, Paperclip, Pencil, Reply, X } from "lucide-react";
import {
  markThreadRead,
  sendEditMessage,
  sendMediaMessage,
  sendThreadReply,
  type MatrixMessage,
  type MatrixMessageReference,
  type MatrixRoomSummary,
} from "@matrix-platform/matrix-core";
import { useMatrix } from "../../app/providers/MatrixContext";
import { Timeline } from "../timeline/Timeline";
import { useThreadMessages } from "./useThreadMessages";
import "./thread-panel.css";

type Props = {
  roomId: string;
  room: MatrixRoomSummary;
  rootId: string;
  view: "flat" | "bubbles";
  highlightMessageId?: string | null;
  editing?: MatrixMessageReference | null;
  replyTo?: MatrixMessageReference | null;
  onOpenImage: (src: string) => void;
  onOpenMessageMenu: (message: MatrixMessage, x: number, y: number) => void;
  onToggleReaction: (message: MatrixMessage, key: string) => void;
  onCancelEdit: () => void;
  onCancelReply: () => void;
  onSent: () => void;
  onClose: () => void;
};

export function ThreadPanel({
  roomId,
  room,
  rootId,
  view,
  highlightMessageId,
  editing,
  replyTo,
  onOpenImage,
  onOpenMessageMenu,
  onToggleReaction,
  onCancelEdit,
  onCancelReply,
  onSent,
  onClose,
}: Props) {
  const { client } = useMatrix();
  const messages = useThreadMessages(client, roomId, rootId);
  const [width, setWidth] = useState(360);
  const [resizing, setResizing] = useState(false);

  const startResize = (event: ReactPointerEvent) => {
    event.preventDefault();
    setResizing(true);
    const onMove = (move: PointerEvent) => {
      // Panel is anchored to the right edge — width grows as the handle moves left.
      setWidth(Math.min(720, Math.max(320, window.innerWidth - move.clientX)));
    };
    const onUp = () => {
      setResizing(false);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  // Reading the thread clears its unread notifications server-side.
  const lastId = messages.length ? messages[messages.length - 1].id : null;
  useEffect(() => {
    if (client && lastId) void markThreadRead(client, roomId, rootId);
  }, [client, roomId, rootId, lastId]);

  return (
    <aside className="thread-panel" style={{ width }}>
      <div
        className={`thread-panel__resizer${resizing ? " is-active" : ""}`}
        onPointerDown={startResize}
      />
      <header className="thread-panel__header">
        <div className="thread-panel__title">
          <MessagesSquare size={18} />
          <span>Тред</span>
        </div>
        <button type="button" className="icon-button" title="Закрыть" onClick={onClose}>
          <X size={18} />
        </button>
      </header>

      <Timeline
        key={rootId}
        messages={messages}
        highlightMessageId={highlightMessageId}
        room={room}
        view={view}
        showIntro={false}
        hasOlder={false}
        onOpenImage={onOpenImage}
        onOpenMessageMenu={onOpenMessageMenu}
        onToggleReaction={onToggleReaction}
        onOpenThread={() => {}}
      />

      <ThreadComposer
        key={editing ? `edit:${editing.id}` : replyTo ? `reply:${replyTo.id}` : "plain"}
        roomId={roomId}
        rootId={rootId}
        editing={editing}
        replyTo={replyTo}
        onCancelEdit={onCancelEdit}
        onCancelReply={onCancelReply}
        onSent={onSent}
      />
    </aside>
  );
}

function ThreadComposer({
  roomId,
  rootId,
  editing,
  replyTo,
  onCancelEdit,
  onCancelReply,
  onSent,
}: {
  roomId: string;
  rootId: string;
  editing?: MatrixMessageReference | null;
  replyTo?: MatrixMessageReference | null;
  onCancelEdit: () => void;
  onCancelReply: () => void;
  onSent: () => void;
}) {
  const { client } = useMatrix();
  const [draft, setDraft] = useState(editing?.text ?? "");
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const send = async () => {
    const text = draft.trim();
    if (!client || !text || sending) return;
    setDraft("");
    setSending(true);
    try {
      if (editing) {
        await sendEditMessage(client, roomId, text, editing.id);
      } else {
        await sendThreadReply(client, roomId, rootId, text, replyTo?.id);
      }
      onSent();
    } catch (error) {
      setDraft(text);
      console.error("[thread-reply]", error);
    } finally {
      setSending(false);
    }
  };

  const sendFiles = async (files: FileList | null) => {
    if (!client || !files?.length || sending) return;
    setSending(true);
    try {
      for (const file of Array.from(files)) {
        await sendMediaMessage(client, roomId, file, await mediaInfo(file), rootId);
      }
    } catch (error) {
      console.error("[thread-media]", error);
    } finally {
      setSending(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <>
      {(editing || replyTo) && (
        <div className="thread-panel__context">
          <span className="thread-panel__context-icon">
            {editing ? <Pencil size={14} /> : <Reply size={15} />}
          </span>
          <div className="thread-panel__context-body">
            <strong>{editing ? "Редактирование" : `Ответ ${replyTo?.author ?? ""}`}</strong>
            <p>{(editing ?? replyTo)?.text || "Сообщение"}</p>
          </div>
          <button
            type="button"
            className="thread-panel__context-cancel"
            title="Отменить"
            onClick={() => {
              if (editing) {
                setDraft("");
                onCancelEdit();
              } else {
                onCancelReply();
              }
            }}
          >
            <X size={15} />
          </button>
        </div>
      )}

      <form
        className="thread-panel__composer"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <button
          type="button"
          className="thread-panel__attach"
          title="Прикрепить"
          disabled={sending}
          onClick={() => fileRef.current?.click()}
        >
          <Paperclip size={18} />
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          hidden
          onChange={(event) => void sendFiles(event.currentTarget.files)}
        />
        <textarea
          className="thread-panel__input"
          value={draft}
          rows={1}
          placeholder={editing ? "Изменить сообщение" : "Ответить в треде"}
          disabled={sending}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
        />
        <button
          type="submit"
          className="thread-panel__send"
          disabled={sending || !draft.trim()}
          title="Отправить"
        >
          <ArrowUp size={18} />
        </button>
      </form>
    </>
  );
}

async function mediaInfo(file: File): Promise<{ width?: number; height?: number }> {
  if (!file.type.startsWith("image/")) return {};
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
    return { width: image.naturalWidth, height: image.naturalHeight };
  } catch {
    return {};
  } finally {
    URL.revokeObjectURL(url);
  }
}
