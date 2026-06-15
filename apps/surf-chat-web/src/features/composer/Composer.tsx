import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, FileText, Forward, Image as ImageIcon, Mic, Paperclip, Pencil, Reply, Smile, X } from "lucide-react";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import { spring, transition } from "@matrix-platform/ui";
import {
  sendEditMessage,
  sendForwardedMessage,
  sendMediaMessage,
  sendReplyMessage,
  sendTextMessage,
  setTyping,
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

export type ComposerHandle = {
  escape: () => boolean;
};

export const Composer = forwardRef<ComposerHandle, Props>(function Composer({
  roomId,
  editingMessage,
  pendingForward,
  replyTo,
  onCancelEdit,
  onCancelForward,
  onCancelReply,
  onSent,
}: Props, ref) {
  const { client } = useMatrix();
  const [draft, setDraft] = useState(editingMessage?.text ?? "");
  const [attachOpen, setAttachOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadState, setUploadState] = useState<{ current: number; total: number; name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const attachWrapRef = useRef<HTMLDivElement>(null);
  const emojiWrapRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastTypingSentRef = useRef(0);
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

  // Tell the server the user stopped typing when the composer unmounts (room
  // switch / logout) so a stale "typing…" doesn't linger for others.
  useEffect(() => {
    return () => {
      if (client && lastTypingSentRef.current) {
        lastTypingSentRef.current = 0;
        void setTyping(client, roomId, false);
      }
    };
  }, [client, roomId]);

  const notifyTyping = (value: string) => {
    if (!client || mode === "edit") return;
    if (!value.trim()) {
      if (lastTypingSentRef.current) {
        lastTypingSentRef.current = 0;
        void setTyping(client, roomId, false);
      }
      return;
    }
    const now = Date.now();
    // Server typing timeout is 4s — refresh at most every 3s to avoid spamming.
    if (now - lastTypingSentRef.current > 3000) {
      lastTypingSentRef.current = now;
      void setTyping(client, roomId, true);
    }
  };

  useEffect(() => {
    if (!attachOpen && !emojiOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!attachWrapRef.current?.contains(event.target as Node)) setAttachOpen(false);
      if (!emojiWrapRef.current?.contains(event.target as Node)) setEmojiOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setAttachOpen(false);
      setEmojiOpen(false);
    };

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [attachOpen, emojiOpen]);

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
    setAttachOpen(false);
    setEmojiOpen(false);
    if (client && lastTypingSentRef.current) {
      lastTypingSentRef.current = 0;
      void setTyping(client, roomId, false);
    }
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
      const allFiles = Array.from(files);
      for (const [index, file] of allFiles.entries()) {
        setUploadState({ current: index + 1, total: allFiles.length, name: file.name });
        await sendMediaMessage(client, roomId, file, await mediaUploadInfo(file));
      }
      onSent();
    } catch (e) {
      console.error("[send-media]", e);
    } finally {
      setUploading(false);
      setUploadState(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  };

  const insertEmoji = (emoji: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setDraft((value) => value + emoji);
      setEmojiOpen(false);
      return;
    }

    const start = textarea.selectionStart ?? draft.length;
    const end = textarea.selectionEnd ?? draft.length;
    const nextDraft = `${draft.slice(0, start)}${emoji}${draft.slice(end)}`;
    setDraft(nextDraft);
    setEmojiOpen(false);

    requestAnimationFrame(() => {
      textarea.focus();
      const caret = start + emoji.length;
      textarea.setSelectionRange(caret, caret);
    });
  };

  useImperativeHandle(ref, () => ({
    escape() {
      if (attachOpen) {
        setAttachOpen(false);
        return true;
      }
      if (emojiOpen) {
        setEmojiOpen(false);
        return true;
      }
      if (pendingForward) {
        onCancelForward();
        return true;
      }
      if (editingMessage) {
        onCancelEdit();
        setDraft("");
        return true;
      }
      if (replyTo) {
        onCancelReply();
        return true;
      }
      if (draft.trim()) {
        setDraft("");
        return true;
      }
      return false;
    },
  }), [attachOpen, draft, editingMessage, emojiOpen, onCancelEdit, onCancelForward, onCancelReply, pendingForward, replyTo]);

  return (
    <div className="composer-wrap">
      <AnimatePresence initial={false}>
        {context && (
          <motion.div
            key={mode}
            className="composer__context"
            initial={{ height: 0, opacity: 0, y: 6 }}
            animate={{ height: "auto", opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: 6 }}
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
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {uploadState && (
          <motion.div
            className="composer__upload"
            initial={{ height: 0, opacity: 0, y: 6 }}
            animate={{ height: "auto", opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: 6 }}
            transition={transition.fast}
          >
            <span className="composer__upload-spinner" />
            <div>
              <strong>
                Загружается {uploadState.current} из {uploadState.total}
              </strong>
              <p>{uploadState.name}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
            onClick={() => {
              setEmojiOpen(false);
              setAttachOpen((value) => !value);
            }}
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
          onChange={(e) => {
            setDraft(e.target.value);
            notifyTyping(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <div className="composer__emoji-wrap" ref={emojiWrapRef}>
          <button
            type="button"
            className={`composer__tool composer__emoji${emojiOpen ? " is-active" : ""}`}
            title="Эмодзи"
            disabled={sending || uploading}
            onClick={() => {
              setAttachOpen(false);
              setEmojiOpen((value) => !value);
            }}
          >
            <Smile size={20} />
          </button>
          <AnimatePresence>
            {emojiOpen && (
              <motion.div
                className="composer__picker"
                initial={{ opacity: 0, scale: 0.96, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 8 }}
                transition={transition.fast}
              >
                <Picker
                  data={data}
                  onEmojiSelect={(event: { native: string }) => insertEmoji(event.native)}
                  theme="light"
                  locale="ru"
                  navPosition="bottom"
                  previewPosition="none"
                  skinTonePosition="none"
                  maxFrequentRows={2}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
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
});

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
