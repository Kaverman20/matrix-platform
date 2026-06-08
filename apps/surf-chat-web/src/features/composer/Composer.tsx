import { useEffect, useRef, useState } from "react";
import { ArrowUp, Pencil, Reply, X } from "lucide-react";
import {
  sendEditMessage,
  sendReplyMessage,
  sendTextMessage,
  type MatrixMessageReference,
} from "@matrix-platform/matrix-core";
import { useMatrix } from "../../app/providers/MatrixContext";
import "./composer.css";

type Props = {
  roomId: string;
  editingMessage?: MatrixMessageReference | null;
  replyTo?: MatrixMessageReference | null;
  onCancelEdit: () => void;
  onCancelReply: () => void;
  onSent: () => void;
};

export function Composer({
  roomId,
  editingMessage,
  replyTo,
  onCancelEdit,
  onCancelReply,
  onSent,
}: Props) {
  const { client } = useMatrix();
  const [draft, setDraft] = useState(editingMessage?.text ?? "");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mode = editingMessage ? "edit" : replyTo ? "reply" : "plain";
  const context = editingMessage ?? replyTo ?? null;

  useEffect(() => {
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!context) return;
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [context]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 118)}px`;
    textarea.style.overflowY = textarea.scrollHeight > 118 ? "auto" : "hidden";
  }, [draft]);

  const send = async () => {
    const text = draft.trim();
    if (!client || !text || sending) return;

    setDraft("");
    setSending(true);
    try {
      if (editingMessage) {
        await sendEditMessage(client, roomId, text, editingMessage.id);
      } else if (replyTo) {
        await sendReplyMessage(client, roomId, text, replyTo);
      } else {
        await sendTextMessage(client, roomId, text);
      }
      onSent();
    } catch (e) {
      setDraft(text);
      console.error("[send-message]", e);
    } finally {
      setSending(false);
    }
  };

  return (
    <form
      className={`composer${context ? " composer--with-context" : ""}`}
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
    >
      {context && (
        <div className="composer__context">
          <span className="composer__context-icon">
            {mode === "edit" ? <Pencil size={15} /> : <Reply size={16} />}
          </span>
          <div>
            <strong>{mode === "edit" ? "Редактирование" : `Ответ ${context.author ? `для ${context.author}` : ""}`}</strong>
            <p>{context.text || "Сообщение"}</p>
          </div>
          <button
            type="button"
            className="composer__cancel"
            title="Отменить"
            onClick={mode === "edit" ? onCancelEdit : onCancelReply}
          >
            <X size={16} />
          </button>
        </div>
      )}
      <textarea
        ref={textareaRef}
        value={draft}
        rows={1}
        placeholder={mode === "edit" ? "Изменить сообщение" : "Сообщение"}
        disabled={sending}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void send();
          }
        }}
      />
      <button type="submit" disabled={!draft.trim() || sending} title="Отправить">
        <ArrowUp size={18} />
      </button>
    </form>
  );
}
