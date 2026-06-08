import { useEffect, useRef, useState } from "react";
import { ArrowUp, Forward, Pencil, Reply, X } from "lucide-react";
import {
  sendEditMessage,
  sendForwardedMessage,
  sendReplyMessage,
  sendTextMessage,
  type MatrixForwardData,
  type MatrixMessageReference,
} from "@matrix-platform/matrix-core";
import { useMatrix } from "../../app/providers/MatrixContext";
import "./composer.css";

type Props = {
  roomId: string;
  editingMessage?: MatrixMessageReference | null;
  pendingForward?: MatrixForwardData[] | null;
  replyTo?: MatrixMessageReference | null;
  onCancelEdit: () => void;
  onCancelForward: () => void;
  onCancelReply: () => void;
  onSent: () => void;
};

export function Composer({
  roomId,
  editingMessage,
  pendingForward,
  replyTo,
  onCancelEdit,
  onCancelForward,
  onCancelReply,
  onSent,
}: Props) {
  const { client } = useMatrix();
  const [draft, setDraft] = useState(editingMessage?.text ?? "");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mode = editingMessage ? "edit" : pendingForward ? "forward" : replyTo ? "reply" : "plain";
  const context = editingMessage ?? replyTo ?? pendingForward?.[0] ?? null;
  const contextAuthor = context && "author" in context ? context.author : undefined;
  const contextTextValue = context && "text" in context ? context.text : undefined;

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
    if (!client || sending) return;
    if (!text && !pendingForward) return;

    setDraft("");
    setSending(true);
    try {
      if (pendingForward) {
        if (text) await sendTextMessage(client, roomId, text);
        for (const [index, forward] of pendingForward.entries()) {
          await delay(index === 0 ? 80 : 140);
          await sendForwardedMessage(client, roomId, forward);
        }
      } else if (editingMessage) {
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
            {mode === "edit" ? <Pencil size={15} /> : mode === "forward" ? <Forward size={16} /> : <Reply size={16} />}
          </span>
          <div>
            <strong>{contextTitle(mode, pendingForward, contextAuthor)}</strong>
            <p>{contextText(mode, pendingForward, contextTextValue)}</p>
          </div>
          <button
            type="button"
            className="composer__cancel"
            title="Отменить"
            onClick={mode === "edit" ? onCancelEdit : mode === "forward" ? onCancelForward : onCancelReply}
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
      <button type="submit" disabled={(!draft.trim() && !pendingForward) || sending} title="Отправить">
        <ArrowUp size={18} />
      </button>
    </form>
  );
}

function contextTitle(
  mode: "edit" | "forward" | "reply" | "plain",
  pendingForward: MatrixForwardData[] | null | undefined,
  author?: string,
): string {
  if (mode === "edit") return "Редактирование";
  if (mode === "forward") {
    const count = pendingForward?.length ?? 0;
    return count > 1 ? `Переслать ${count} сообщения` : "Переслать сообщение";
  }
  return `Ответ ${author ? `для ${author}` : ""}`;
}

function contextText(
  mode: "edit" | "forward" | "reply" | "plain",
  pendingForward: MatrixForwardData[] | null | undefined,
  text?: string,
): string {
  if (mode !== "forward") return text || "Сообщение";
  if (!pendingForward?.length) return "Сообщение";
  if (pendingForward.length > 1) return `От: ${pendingForward[0].author}`;
  return `${pendingForward[0].author}: ${pendingForward[0].preview}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
