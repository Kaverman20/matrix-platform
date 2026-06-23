import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ClipboardEvent as ReactClipboardEvent, type DragEvent as ReactDragEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, BarChart3, Ban, FileText, Forward, Image as ImageIcon, Mic, Paperclip, Pencil, Reply, Smile, Trash2, X } from "lucide-react";
import { spring, transition } from "@matrix-platform/ui";
import { EmojiPicker } from "../../components/EmojiPicker";
import { CreatePollModal } from "./CreatePollModal";
import { MediaPreviewModal, type MediaPreviewMode } from "./MediaPreviewModal";
import {
  sendEditMessage,
  sendForwardedMessage,
  sendMediaMessage,
  sendPollStart,
  sendReplyMessage,
  sendTextMessage,
  sendVoiceMessage,
  setTyping,
  slashCommandHelpText,
  loadRoomDraft,
  wrapComposerSelection,
  transformComposerSelection,
  type MatrixForwardData,
  type MatrixMentionMember,
  type MatrixMessageReference,
  type PollStartInput,
  type RoomSendPermission,
  type TextTransformMode,
  type TextWrapMode,
} from "@matrix-platform/matrix-core";
import { useMatrix } from "../../app/providers/MatrixContext";
import { usePreferences } from "../../app/providers/usePreferences";
import { composerSubmitOnKeyDown } from "./composerKeys";
import { useVoiceRecorder } from "./useVoiceRecorder";
import { RecordingWaveform } from "./RecordingWaveform";
import { formatRecordingTime, waveformFromBlob } from "../media/waveform";
import { compressImage } from "../media/compressImage";
import { MentionAutocomplete } from "./MentionAutocomplete";
import { ComposerTextMenu } from "./ComposerTextMenu";
import { useMentionAutocomplete } from "./useMentionAutocomplete";
import { useComposerDraft } from "./useComposerDraft";
import { useComposerTextSelection } from "./useComposerTextSelection";
import "./composer.css";

type Props = {
  roomId: string;
  members?: readonly MatrixMentionMember[];
  editingMessage?: MatrixMessageReference | null;
  pendingForward?: MatrixForwardData[] | null;
  replyTo?: MatrixMessageReference | null;
  sendPermission?: RoomSendPermission;
  onCancelEdit: () => void;
  onCancelForward: () => void;
  onCancelReply: () => void;
  onSent: () => void;
};

const READ_ONLY_REASON: Record<Exclude<RoomSendPermission, { canSend: true }>["reason"], string> = {
  banned: "Вы заблокированы в этом чате",
  left: "Вы не участник этого чата",
  "no-permission": "Только администраторы могут писать здесь",
  tombstoned: "Этот чат перемещён и доступен только для чтения",
};

export type ComposerHandle = {
  escape: () => boolean;
};

// Keep in sync with `.composer__input { max-height }` in composer.css.
const COMPOSER_MAX_HEIGHT = 160;

export const Composer = forwardRef<ComposerHandle, Props>(function Composer({
  roomId,
  members = [],
  editingMessage,
  pendingForward,
  replyTo,
  sendPermission,
  onCancelEdit,
  onCancelForward,
  onCancelReply,
  onSent,
}: Props, ref) {
  const { client } = useMatrix();
  const { preferences } = usePreferences();
  const [draft, setDraft] = useState(() => initialDraft(roomId, editingMessage?.text));
  const [attachOpen, setAttachOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  // Файлы, ожидающие отправки: показываем превью с подписью (скрепка / DnD / вставка).
  const [pendingMedia, setPendingMedia] = useState<{ files: File[]; mode: MediaPreviewMode } | null>(null);
  // Активен оверлей drag&drop с двумя зонами (фото / файл).
  const [dragActive, setDragActive] = useState(false);
  // Зона, над которой сейчас файл — подсвечиваем её сразу по dragover, а не через
  // CSS :hover (он во время нативного перетаскивания обновляется с задержкой).
  const [activeZone, setActiveZone] = useState<MediaPreviewMode | null>(null);
  const dragDepthRef = useRef(0);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadState, setUploadState] = useState<{ current: number; total: number; name: string } | null>(null);
  const [textMenu, setTextMenu] = useState<{ x: number; y: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const attachWrapRef = useRef<HTMLDivElement>(null);
  const emojiWrapRef = useRef<HTMLDivElement>(null);
  const composerWrapRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastTypingSentRef = useRef(0);
  const voice = useVoiceRecorder();
  const mode = editingMessage ? "edit" : pendingForward ? "forward" : replyTo ? "reply" : "plain";
  const context = editingMessage ?? replyTo ?? pendingForward?.[0] ?? null;
  const contextAuthor = context && "author" in context ? context.author : undefined;
  const contextTextValue = context && "text" in context ? context.text : undefined;
  const mentionMembers = members;
  const mentions = useMentionAutocomplete({
    members: mentionMembers,
    excludeUserId: client?.getUserId(),
  });
  const { clearDraft } = useComposerDraft({
    roomId,
    draft,
    disabled: mode === "edit",
  });
  const { selection, syncSelection } = useComposerTextSelection();

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

  // Closes over refs only (stable), so it's safe to use from effects with []
  // deps without going stale.
  const publishComposerHeight = () => {
    const node = composerWrapRef.current;
    if (!node) return;
    document.documentElement.style.setProperty("--composer-h", `${node.offsetHeight}px`);
    // Tell the timeline to re-pin to the bottom right now (same frame) so the
    // latest message tracks the composer height without a visible lag.
    window.dispatchEvent(new Event("surf-composer-resize"));
  };

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Read the cap from CSS (`.composer__input { max-height }`) so JS and CSS
    // can't disagree. Falls back to a sane default if it can't be parsed.
    const maxHeight = parseFloat(getComputedStyle(textarea).maxHeight) || COMPOSER_MAX_HEIGHT;
    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
    // Publish the new composer height + ask the timeline to re-pin synchronously
    // in the SAME frame as the keystroke — going through a ResizeObserver here
    // costs several frames in Safari and lets the last message flash under the
    // composer before the re-pin catches up.
    publishComposerHeight();
  }, [draft]);

  // Publish the composer's real height as a CSS variable so the timeline reserves
  // exactly that much room at the bottom (--composer-h drives the message-list
  // spacer + the re-pin). Fires on draft typing (above), and on any other height
  // change — reply/edit bar appearing, window resize — via this observer.
  useEffect(() => {
    publishComposerHeight();
    const node = composerWrapRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => publishComposerHeight());
    observer.observe(node);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty("--composer-h");
    };
  }, []);

  useEffect(() => {
    if (editingMessage) {
      setDraft(editingMessage.text ?? "");
    }
  }, [editingMessage]);

  const sendOptions = { members: mentionMembers };

  const send = async () => {
    const text = draft.trim();
    if (!client || sending) return;
    if (!text && !pendingForward) return;

    setDraft("");
    clearDraft();
    setSending(true);
    setAttachOpen(false);
    setEmojiOpen(false);
    mentions.close();
    if (client && lastTypingSentRef.current) {
      lastTypingSentRef.current = 0;
      void setTyping(client, roomId, false);
    }
    try {
      if (pendingForward) {
        if (text) {
          const result = await sendTextMessage(client, roomId, text, sendOptions);
          if (result === "help") {
            setDraft(slashCommandHelpText());
            return;
          }
          if (result === "clear") return;
        }
        for (const [index, forward] of pendingForward.entries()) {
          await delay(index === 0 ? 80 : 140);
          await sendForwardedMessage(client, roomId, forward);
        }
      } else if (editingMessage) {
        await sendEditMessage(client, roomId, text, editingMessage.id);
      } else if (replyTo) {
        const result = await sendReplyMessage(client, roomId, text, replyTo, sendOptions);
        if (result === "help") {
          setDraft(slashCommandHelpText());
          return;
        }
        if (result === "clear") return;
      } else {
        const result = await sendTextMessage(client, roomId, text, sendOptions);
        if (result === "help") {
          setDraft(slashCommandHelpText());
          return;
        }
        if (result === "clear") return;
      }
      onSent();
    } catch (e) {
      setDraft(text);
      console.error("[send-message]", e);
    } finally {
      setSending(false);
    }
  };

  const canAttach = mode !== "edit" && !(sendPermission && !sendPermission.canSend);

  // Открыть превью с файлами. Если превью уже открыто — дополняем альбом
  // (кнопка «Добавить» в самой модалке), иначе создаём новое с режимом зоны.
  const openMediaPreview = (files: File[], previewMode: MediaPreviewMode) => {
    if (!canAttach || !files.length) return;
    setAttachOpen(false);
    setEmojiOpen(false);
    setPendingMedia((prev) =>
      prev
        ? { ...prev, files: [...prev.files, ...files].slice(0, 10) }
        : { files: files.slice(0, 10), mode: previewMode },
    );
  };

  const triggerAddMore = (addMode: MediaPreviewMode) => {
    if (addMode === "file") fileInputRef.current?.click();
    else imageInputRef.current?.click();
  };

  // Убрать один файл из превью; если файлов не осталось — закрываем окно.
  const removePendingFile = (index: number) => {
    setPendingMedia((prev) => {
      if (!prev) return null;
      const files = prev.files.filter((_, i) => i !== index);
      return files.length ? { ...prev, files } : null;
    });
  };

  const onFileInputChange = (input: HTMLInputElement | null, inputMode: MediaPreviewMode) => {
    if (input?.files?.length) openMediaPreview(Array.from(input.files), inputMode);
    if (input) input.value = "";
  };

  // Реальная отправка из превью: грузим файлы по очереди, подпись вешаем на
  // последнее сообщение альбома (как в Telegram).
  const submitMedia = async (files: File[], caption: string, asFile: boolean) => {
    if (!client || !files.length || sending || uploading) return;
    setPendingMedia(null);
    setUploading(true);
    // Несколько файлов помечаем одним albumId — в ленте они склеятся в «пак».
    const albumId = files.length > 1 ? crypto.randomUUID() : undefined;
    try {
      for (const [index, file] of files.entries()) {
        setUploadState({ current: index + 1, total: files.length, name: file.name });
        // В режиме «медиа» картинки сжимаем; в режиме «файл» шлём оригинал.
        const outgoing = asFile ? file : await compressImage(file);
        await sendMediaMessage(client, roomId, outgoing, await mediaUploadInfo(outgoing), undefined, {
          asFile,
          // Подпись — на первом элементе альбома (одна на весь пак, как в Telegram).
          caption: index === 0 ? caption : undefined,
          album: albumId ? { id: albumId, index, total: files.length } : undefined,
        });
      }
      onSent();
    } catch (e) {
      console.error("[send-media]", e);
    } finally {
      setUploading(false);
      setUploadState(null);
    }
  };

  // Drag&drop файлов в окно: показываем затемняющий оверлей с двумя зонами.
  // Счётчик глубины гасит мерцание при наведении на вложенные элементы.
  useEffect(() => {
    if (!canAttach) return;

    const hasFiles = (event: DragEvent) =>
      Array.from(event.dataTransfer?.types ?? []).includes("Files");

    const onDragEnter = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      dragDepthRef.current += 1;
      setDragActive(true);
    };
    const onDragOver = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
    };
    const onDragLeave = () => {
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) {
        setDragActive(false);
        setActiveZone(null);
      }
    };
    const onDrop = (event: DragEvent) => {
      // Дроп мимо зон — гасим оверлей и не даём браузеру открыть файл.
      if (hasFiles(event)) event.preventDefault();
      dragDepthRef.current = 0;
      setDragActive(false);
      setActiveZone(null);
    };

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [canAttach]);

  const handleZoneDrop = (event: ReactDragEvent<HTMLDivElement>, zoneMode: MediaPreviewMode) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = 0;
    setDragActive(false);
    setActiveZone(null);
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (files.length) openMediaPreview(files, zoneMode);
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
      mentions.syncFromDraft(nextDraft, caret);
    });
  };

  const applyFormatting = (mode: TextWrapMode) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart ?? draft.length;
    const end = textarea.selectionEnd ?? draft.length;
    const next = wrapComposerSelection(draft, start, end, mode);
    setDraft(next.text);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(next.selectionStart, next.selectionEnd);
      mentions.syncFromDraft(next.text, next.selectionStart);
      syncSelection(textarea);
    });
  };

  const applyTransform = (mode: TextTransformMode) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart ?? draft.length;
    const end = textarea.selectionEnd ?? draft.length;
    const next = transformComposerSelection(draft, start, end, mode);
    setDraft(next.text);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(next.selectionStart, next.selectionEnd);
      syncSelection(textarea);
    });
  };

  const cutSelection = () => {
    const textarea = textareaRef.current;
    if (!textarea || selection.start === selection.end) return;
    const selected = draft.slice(selection.start, selection.end);
    void navigator.clipboard.writeText(selected);
    const nextText = `${draft.slice(0, selection.start)}${draft.slice(selection.end)}`;
    setDraft(nextText);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(selection.start, selection.start);
      syncSelection(textarea);
    });
  };

  const copySelection = () => {
    if (selection.start === selection.end) return;
    void navigator.clipboard.writeText(draft.slice(selection.start, selection.end));
  };

  const pasteFromClipboard = async () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    try {
      const pasted = await navigator.clipboard.readText();
      const start = textarea.selectionStart ?? draft.length;
      const end = textarea.selectionEnd ?? draft.length;
      const nextText = `${draft.slice(0, start)}${pasted}${draft.slice(end)}`;
      const caret = start + pasted.length;
      setDraft(nextText);
      notifyTyping(nextText);
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(caret, caret);
        mentions.syncFromDraft(nextText, caret);
        syncSelection(textarea);
      });
    } catch {
      // Clipboard read may be blocked — fall back to native paste.
      document.execCommand("paste");
    }
  };

  const handleDraftChange = (value: string, textarea = textareaRef.current) => {
    setDraft(value);
    notifyTyping(value);
    setTextMenu(null);
    mentions.syncFromDraft(value, textarea?.selectionStart ?? value.length);
    syncSelection(textarea);
  };

  const selectMention = (member: MatrixMentionMember) => {
    const textarea = textareaRef.current;
    const cursor = textarea?.selectionStart ?? draft.length;
    const next = mentions.applySelection(draft, cursor, member);
    setDraft(next.text);
    requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(next.cursor, next.cursor);
    });
  };

  const handleComposerKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && !event.altKey) {
      const key = event.key.toLowerCase();
      if (key === "b") {
        event.preventDefault();
        applyFormatting("bold");
        return;
      }
      if (key === "i") {
        event.preventDefault();
        applyFormatting("italic");
        return;
      }
      if (key === "u") {
        event.preventDefault();
        applyFormatting("link");
        return;
      }
      if (event.shiftKey && key === "k") {
        event.preventDefault();
        applyFormatting("code");
        return;
      }
      if (event.shiftKey && key === "x") {
        event.preventDefault();
        applyFormatting("strikethrough");
        return;
      }
    }

    if (mentions.open && mentions.candidates.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        mentions.moveActive(1);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        mentions.moveActive(-1);
        return;
      }
      if ((event.key === "Enter" || event.key === "Tab") && mentions.activeCandidate) {
        event.preventDefault();
        selectMention(mentions.activeCandidate);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        mentions.close();
        return;
      }
    }

    composerSubmitOnKeyDown(event, {
      enterToSend: preferences.enterToSend,
      submit: submitComposer,
    });
  };

  const sendVoice = async () => {
    if (!client || sending || uploading) return;
    const durationMs = Math.max(voice.elapsedMs, 1);
    const blob = await voice.stop();
    if (!blob || blob.size === 0) return;

    setSending(true);
    try {
      const waveform = await waveformFromBlob(blob);
      await sendVoiceMessage(client, roomId, blob, durationMs, undefined, waveform);
      onSent();
    } catch (error) {
      console.error("[send-voice]", error);
    } finally {
      setSending(false);
    }
  };

  const handlePaste = (event: ReactClipboardEvent<HTMLTextAreaElement>) => {
    if (!canAttach) return;
    const items = event.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (const item of items) {
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length) {
      event.preventDefault();
      openMediaPreview(files, "photo");
    }
  };

  const submitComposer = () => {
    void send();
  };

  const createPoll = async (input: PollStartInput) => {
    if (!client) return;
    try {
      await sendPollStart(client, roomId, input);
      setPollOpen(false);
      onSent();
    } catch (e) {
      console.error("[send-poll]", e);
    }
  };

  useImperativeHandle(ref, () => ({
    escape() {
      if (dragActive) {
        dragDepthRef.current = 0;
        setDragActive(false);
        return true;
      }
      if (pendingMedia) {
        setPendingMedia(null);
        return true;
      }
      if (pollOpen) {
        setPollOpen(false);
        return true;
      }
      if (voice.state === "recording") {
        voice.cancel();
        return true;
      }
      if (mentions.open) {
        mentions.close();
        return true;
      }
      if (textMenu) {
        setTextMenu(null);
        return true;
      }
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
        clearDraft();
        return true;
      }
      return false;
    },
  }), [attachOpen, clearDraft, draft, dragActive, editingMessage, emojiOpen, mentions, onCancelEdit, onCancelForward, onCancelReply, pendingForward, pendingMedia, pollOpen, replyTo, textMenu, voice]);

  // Оверлей DnD рендерим порталом в область чата (.chat-main), чтобы он накрывал
  // именно переписку, а не сайдбар — как в Telegram.
  const dropContainer = composerWrapRef.current?.closest(".chat-main") ?? null;

  const readOnlyReason = sendPermission && !sendPermission.canSend ? sendPermission.reason : null;
  if (readOnlyReason) {
    return (
      <div className="composer-wrap" ref={composerWrapRef}>
        <div className="composer-readonly">
          <Ban size={16} />
          <span>{READ_ONLY_REASON[readOnlyReason]}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="composer-wrap" ref={composerWrapRef}>
      {pollOpen && (
        <CreatePollModal onSubmit={createPoll} onClose={() => setPollOpen(false)} />
      )}
      <AnimatePresence>
        {pendingMedia && (
          <MediaPreviewModal
            files={pendingMedia.files}
            mode={pendingMedia.mode}
            onSubmit={submitMedia}
            onAddMore={triggerAddMore}
            onRemove={removePendingFile}
            onClose={() => setPendingMedia(null)}
          />
        )}
      </AnimatePresence>
      {dropContainer &&
        createPortal(
          <AnimatePresence>
            {dragActive && (
              <motion.div
                className="composer-dropzones"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
              >
                <div
                  className={`composer-dropzone${activeZone === "file" ? " is-over" : ""}`}
                  onDragEnter={() => setActiveZone("file")}
                  onDragOver={(event) => {
                    event.preventDefault();
                    if (activeZone !== "file") setActiveZone("file");
                  }}
                  onDrop={(event) => handleZoneDrop(event, "file")}
                >
                  <span>Перетащите сюда файлы для отправки</span>
                  <strong>без сжатия</strong>
                </div>
                <div
                  className={`composer-dropzone${activeZone === "photo" ? " is-over" : ""}`}
                  onDragEnter={() => setActiveZone("photo")}
                  onDragOver={(event) => {
                    event.preventDefault();
                    if (activeZone !== "photo") setActiveZone("photo");
                  }}
                  onDrop={(event) => handleZoneDrop(event, "photo")}
                >
                  <span>Перетащите сюда файлы для отправки</span>
                  <strong>быстрым способом</strong>
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          dropContainer,
        )}
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
        className={`composer${voice.state === "recording" ? " composer--recording" : ""}`}
        onSubmit={(e) => {
          e.preventDefault();
          submitComposer();
        }}
      >
        {voice.state === "recording" ? (
          <>
            <button
              type="button"
              className="composer__voice-cancel"
              title="Отменить запись"
              onClick={voice.cancel}
            >
              <Trash2 size={18} />
            </button>
            <div className="composer__voice-panel">
              <RecordingWaveform levels={voice.levels} />
              <span className="composer__voice-timer">{formatRecordingTime(voice.elapsedMs)}</span>
            </div>
          </>
        ) : (
          <>
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
            <Paperclip size={18} strokeWidth={2.25} />
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
                <button
                  type="button"
                  className="attach-menu__item"
                  onClick={() => {
                    setPollOpen(true);
                    setAttachOpen(false);
                  }}
                >
                  <BarChart3 size={18} />
                  <span>Опрос</span>
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
            onChange={(event) => onFileInputChange(event.currentTarget, "photo")}
          />
          <input
            ref={fileInputRef}
            type="file"
            multiple
            hidden
            onChange={(event) => onFileInputChange(event.currentTarget, "file")}
          />
        </div>
        <div className="composer__input-wrap">
          {mentions.open && (
            <MentionAutocomplete
              candidates={mentions.candidates}
              activeIndex={mentions.activeIndex}
              onSelect={selectMention}
            />
          )}
          <textarea
            ref={textareaRef}
            className="composer__input"
            value={draft}
            rows={1}
            placeholder={mode === "edit" ? "Изменить сообщение" : "Сообщение…"}
            disabled={sending || uploading}
            onChange={(e) => handleDraftChange(e.target.value, e.currentTarget)}
            onPaste={handlePaste}
            onKeyDown={handleComposerKeyDown}
            onKeyUp={(e) => syncSelection(e.currentTarget)}
            onContextMenu={(event) => {
              event.preventDefault();
              syncSelection(event.currentTarget);
              setTextMenu({ x: event.clientX, y: event.clientY });
              event.currentTarget.focus();
            }}
            onSelect={(e) => syncSelection(e.currentTarget)}
            onClick={(event) => {
              const target = event.currentTarget;
              mentions.syncFromDraft(target.value, target.selectionStart ?? target.value.length);
              syncSelection(target);
            }}
          />
        </div>
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
            <Smile size={18} strokeWidth={2.25} />
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
                <EmojiPicker onSelect={(native) => insertEmoji(native)} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
          </>
        )}
        {draft.trim() || pendingForward ? (
          <motion.button
            type="submit"
            className="composer__send"
            disabled={sending || uploading || voice.state === "recording"}
            title="Отправить"
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.94 }}
            transition={spring.snappy}
          >
            <ArrowUp size={18} />
          </motion.button>
        ) : voice.state === "recording" ? (
          <button
            type="button"
            className="composer__send"
            disabled={sending || uploading}
            title="Отправить голосовое"
            onClick={() => void sendVoice()}
          >
            <ArrowUp size={18} />
          </button>
        ) : (
          <button
            type="button"
            className="composer__tool composer__mic"
            disabled={sending || uploading || mode === "edit"}
            title="Голосовое сообщение"
            onClick={() => void voice.start()}
          >
            <Mic size={18} strokeWidth={2.25} />
          </button>
        )}
      </form>
      {textMenu && (
        <ComposerTextMenu
          x={textMenu.x}
          y={textMenu.y}
          hasSelection={selection.hasSelection}
          onClose={() => setTextMenu(null)}
          onWrap={applyFormatting}
          onTransform={applyTransform}
          onCut={cutSelection}
          onCopy={copySelection}
          onPaste={() => void pasteFromClipboard()}
        />
      )}
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

function initialDraft(roomId: string, editingText?: string | null): string {
  if (editingText) return editingText;
  return loadRoomDraft(localStorage, roomId);
}

