import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, FileText, Forward, Image as ImageIcon, Mic, Paperclip, Pencil, Reply, Smile, X } from "lucide-react";
import { spring, transition } from "@matrix-platform/ui";
import {
  sendEditMessage,
  sendForwardedMessage,
  sendMediaMessage,
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
  const [attachOpen, setAttachOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const attachWrapRef = useRef<HTMLDivElement>(null);
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
    if (!attachOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!attachWrapRef.current?.contains(event.target as Node)) setAttachOpen(false);
    };

    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [attachOpen]);

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

  const sendFiles = async (files: FileList | null) => {
    if (!client || !files?.length || sending || uploading) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await sendMediaMessage(client, roomId, file, await mediaUploadInfo(file));
      }
      onSent();
    } catch (e) {
      console.error("[send-media]", e);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="composer-wrap">
      {context && (
        <motion.div
          className="composer__context"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={transition.fast}
        >
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
        </motion.div>
      )}
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <div className="composer__attach" ref={attachWrapRef}>
          <button
            type="button"
            className={`composer__tool${attachOpen ? " is-active" : ""}`}
            disabled={sending || uploading || mode === "edit"}
            title="Прикрепить"
            onClick={() => setAttachOpen((value) => !value)}
          >
            <Paperclip size={20} />
          </button>
          <AnimatePresence>
            {attachOpen && (
              <motion.div
                className="attach-menu"
                initial={{ opacity: 0, scale: 0.94, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: 8 }}
                transition={transition.fast}
              >
                <button
                  type="button"
                  className="attach-menu__item"
                  onClick={() => {
                    imageInputRef.current?.click();
                    setAttachOpen(false);
                  }}
                >
                  <ImageIcon size={18} />
                  <span>Фото или видео</span>
                </button>
                <button
                  type="button"
                  className="attach-menu__item"
                  onClick={() => {
                    fileInputRef.current?.click();
                    setAttachOpen(false);
                  }}
                >
                  <FileText size={18} />
                  <span>Файл</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            hidden
            onChange={(event) => void sendFiles(event.currentTarget.files)}
          />
          <input
            ref={fileInputRef}
            type="file"
            multiple
            hidden
            onChange={(event) => void sendFiles(event.currentTarget.files)}
          />
        </div>
        <textarea
          ref={textareaRef}
          className="composer__input"
          value={draft}
          rows={1}
          placeholder={mode === "edit" ? "Изменить сообщение" : "Сообщение"}
          disabled={sending || uploading}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <button type="button" className="composer__tool composer__emoji" title="Эмодзи">
          <Smile size={20} />
        </button>
        {draft.trim() || pendingForward ? (
          <motion.button
            type="submit"
            className="composer__send"
            disabled={sending || uploading}
            title="Отправить"
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.94 }}
            transition={spring.snappy}
          >
            <ArrowUp size={18} />
          </motion.button>
        ) : (
          <button
            type="button"
            className="composer__tool composer__mic"
            disabled={sending || uploading}
            title="Голосовое сообщение"
          >
            <Mic size={20} />
          </button>
        )}
      </form>
    </div>
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

async function mediaUploadInfo(file: File): Promise<{
  height?: number;
  width?: number;
}> {
  if (!file.type.startsWith("image/")) return {};

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl);
    return { height: image.naturalHeight, width: image.naturalWidth };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}
