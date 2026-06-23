import { useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Forward, Pin, Reply, SmilePlus } from "lucide-react";
import type { MatrixMessage } from "@matrix-platform/matrix-core";
import { AuthedImage } from "../../components/AuthedImage";
import { MessageMedia } from "../media/MessageMedia";
import { MessageAlbum } from "../media/MessageAlbum";
import type { LightboxState } from "../media/Lightbox";
import { ReactionPill } from "../reactions/ReactionPill";
import { BubbleShell } from "./BubbleShell";
import type { BubblePosition } from "./bubbleShape";
import { MessageBody } from "./MessageBody";
import { PollMessage } from "./PollMessage";
import { DeliveryStatus } from "./DeliveryStatus";
import { ThreadChip } from "./ThreadChip";
import { useTimeFormatter } from "../../app/providers/usePreferences";

export type MessageRowProps = {
  compact: boolean;
  highlighted: boolean;
  message: MatrixMessage;
  onOpenImage: (state: LightboxState) => void;
  onOpenMessageMenu: (message: MatrixMessage, x: number, y: number) => void;
  onToggleReaction: (message: MatrixMessage, key: string) => void;
  onOpenThread: (rootId: string) => void;
  onJumpToMessage?: (messageId: string) => void;
  onQuickReply?: (message: MatrixMessage) => void;
  onQuickReact?: (message: MatrixMessage, key: string) => void;
  searchQuery?: string;
  selectionActive?: boolean;
  onShowEditHistory?: (message: MatrixMessage) => void;
  onShowReaders?: (message: MatrixMessage, anchorRect: DOMRect) => void;
  onVotePoll?: (messageId: string, answerIds: string[]) => void;
};

export function FlatMessage({
  compact,
  highlighted,
  message,
  onOpenImage,
  onOpenMessageMenu,
  onToggleReaction,
  onOpenThread,
  onJumpToMessage,
  onQuickReply,
  onQuickReact,
  searchQuery,
  selectionActive = false,
  onShowEditHistory,
  onShowReaders,
  onVotePoll,
}: MessageRowProps) {
  const formatTime = useTimeFormatter();
  return (
    <article
      data-mid={message.id}
      className={`message${compact ? " message--compact" : ""}${highlighted ? " message--highlight" : ""}`}
      onContextMenu={(event) => {
        event.preventDefault();
        onOpenMessageMenu(message, event.clientX, event.clientY);
      }}
    >
      {!selectionActive && (
      <MessageHoverActions
        message={message}
        onQuickReply={onQuickReply}
        onQuickReact={onQuickReact}
      />
      )}
      {compact ? (
        <span className="message__avatar message__avatar--spacer" />
      ) : (
        <span className="message__avatar" style={{ background: message.color }}>
          <span className="message__avatar-fallback">{message.author.slice(0, 1).toUpperCase()}</span>
          {message.avatarUrl && <AuthedImage url={message.avatarUrl} className="message__avatar-img" />}
        </span>
      )}
      <div className="message__body">
        {!compact && (
          <header className="message__head">
            <strong style={{ color: senderNameColor(message) }}>{message.own ? "Вы" : message.author}</strong>
          </header>
        )}
        <MessageContent
          message={message}
          onOpenImage={onOpenImage}
          onJumpToMessage={onJumpToMessage}
          searchQuery={searchQuery}
          onShowEditHistory={onShowEditHistory}
          onVotePoll={onVotePoll}
        />
        {message.reactions.length > 0 && (
          <motion.div className="message__reactions" layout>
            <AnimatePresence initial={false}>
              {message.reactions.map((reaction) => (
                <ReactionPill
                  key={reaction.key}
                  reaction={reaction}
                  onToggle={() => onToggleReaction(message, reaction.key)}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
        {message.thread && <ThreadChip message={message} onOpenThread={onOpenThread} />}
      </div>
      <div className="message__aside">
        {message.pinned && <Pin size={12} className="message__pin" aria-label="Закреплено" />}
        {message.own && (
          <DeliveryStatus
            status={message.deliveryStatus}
            onShowReaders={
              onShowReaders
                ? (anchorRect) => onShowReaders(message, anchorRect)
                : undefined
            }
          />
        )}
        <time>{formatTime(message.timestamp)}</time>
      </div>
    </article>
  );
}

export function BubbleMessage({
  compact,
  groupEnd,
  highlighted,
  message,
  onOpenImage,
  onOpenMessageMenu,
  onToggleReaction,
  onOpenThread,
  onJumpToMessage,
  onQuickReply,
  onQuickReact,
  searchQuery,
  selectionActive = false,
  onShowEditHistory,
  onShowReaders,
  onVotePoll,
}: MessageRowProps & { groupEnd: boolean }) {
  const formatTime = useTimeFormatter();
  // Grouping position drives the glued corner radii (and tail) in BubbleShell.
  const position: BubblePosition = compact
    ? groupEnd
      ? "last"
      : "middle"
    : groupEnd
      ? "single"
      : "first";
  return (
    <article
      data-mid={message.id}
      className={`mb${message.own ? " mb--own" : ""}${compact ? " mb--cont" : ""}${highlighted ? " mb--highlight" : ""}`}
      onContextMenu={(event) => {
        event.preventDefault();
        onOpenMessageMenu(message, event.clientX, event.clientY);
      }}
    >
      {!selectionActive && (
      <MessageHoverActions
        message={message}
        onQuickReply={onQuickReply}
        onQuickReact={onQuickReact}
      />
      )}
      {!message.own && (
        <span
          className="mb__avatar"
          style={compact ? { visibility: "hidden", background: "transparent" } : { background: message.color }}
        >
          {!compact && (
            <>
              <span className="message__avatar-fallback">{message.author.slice(0, 1).toUpperCase()}</span>
              {message.avatarUrl && <AuthedImage url={message.avatarUrl} className="message__avatar-img" />}
            </>
          )}
        </span>
      )}
      <BubbleShell own={message.own} position={position} highlighted={highlighted}>
        {!message.own && !compact && (
          <div className="bubble__author" style={{ color: message.color }}>
            {message.author}
          </div>
        )}
        <MessageContent
          message={message}
          onOpenImage={onOpenImage}
          onJumpToMessage={onJumpToMessage}
          searchQuery={searchQuery}
          onShowEditHistory={onShowEditHistory}
          onShowReaders={onShowReaders}
          onVotePoll={onVotePoll}
          formatTime={formatTime}
          bubble
        />
        {message.reactions.length > 0 && (
          <div className="message__reactions">
            <AnimatePresence initial={false}>
              {message.reactions.map((reaction) => (
                <ReactionPill
                  key={reaction.key}
                  reaction={reaction}
                  onToggle={() => onToggleReaction(message, reaction.key)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
        {message.thread && <ThreadChip message={message} onOpenThread={onOpenThread} />}
      </BubbleShell>
    </article>
  );
}

/**
 * Когда время float'ом не помещается на последней строке текста, shrink-to-fit
 * всё равно считает ширину бабла как «текст + время в одну строку» и упирает её
 * в max-width — бабл оказывается шире текста, а время висит у его края, а не под
 * текстом. CSS этого не решает (max-content всегда без переноса), поэтому меряем:
 * если время перенеслось — возвращаем фактическую максимальную ширину строки
 * текста, чтобы явно сузить бабл по тексту (как в Telegram). Иначе — null (авто).
 */
function useBubbleTextHug(enabled: boolean, signature: string) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [hugWidth, setHugWidth] = useState<number | null>(null);

  useLayoutEffect(() => {
    let frame = 0;
    if (!enabled) {
      // Сброс откладываем кадром — синхронный setState в эффекте запрещён линтом.
      frame = requestAnimationFrame(() => setHugWidth((prev) => (prev === null ? prev : null)));
      return () => cancelAnimationFrame(frame);
    }
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      frame = 0;
      const time = el.querySelector<HTMLElement>(".bubble__time--inline");
      if (!time) {
        setHugWidth((prev) => (prev === null ? prev : null));
        return;
      }
      // Решаем о переносе по ЕСТЕСТВЕННОЙ ширине: снимаем наш width-override,
      // иначе бабл уже сужен по тексту и время всегда «перенесено» (залипание).
      const applied = el.style.width;
      el.style.width = "";
      const range = document.createRange();
      range.setStart(el, 0);
      range.setEndBefore(time);
      let maxLine = 0;
      let lastRect: DOMRect | null = null;
      for (const r of range.getClientRects()) {
        if (r.width > maxLine) maxLine = r.width;
        if (r.width > 0) lastRect = r;
      }
      // Время перенеслось, если его верх ниже последней строки текста
      // (сравниваем геометрию — offsetTop тут считается от offsetParent).
      const wrapped = lastRect ? time.getBoundingClientRect().top - lastRect.top > 3 : false;
      const next = wrapped ? Math.ceil(maxLine) : null;
      el.style.width = applied; // вернём как было; React перепишет при смене стейта
      setHugWidth((prev) => (prev === next ? prev : next));
    };

    // Меряем после применённого hugWidth: запрашиваем кадр, чтобы лэйаут устоялся.
    measure();
    const ro = new ResizeObserver(() => {
      if (frame) return;
      frame = requestAnimationFrame(measure);
    });
    ro.observe(el);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      ro.disconnect();
    };
    // signature меняется при смене текста/времени → пере-замер для нового контента.
  }, [enabled, signature]);

  return { ref, hugWidth };
}

/**
 * Мета-строка бабла (булавка + «изменено» + время + статус доставки).
 * Два режима:
 *  - "inline": время float'ом справа в конце текста (ТГ-стиль) — на одной линии
 *    с последней строкой, либо вправо-вниз под текст, если не помещается.
 *  - "block": обычная строка под контентом (для медиа/опросов без текста).
 */
function BubbleMeta({
  message,
  formatTime,
  variant,
  onShowEditHistory,
  onShowReaders,
}: {
  message: MatrixMessage;
  formatTime: (timestamp: number) => string;
  variant: "inline" | "block";
  onShowEditHistory?: (message: MatrixMessage) => void;
  onShowReaders?: (message: MatrixMessage, anchorRect: DOMRect) => void;
}) {
  return (
    <span className={`bubble__time bubble__time--${variant}`}>
      {message.pinned && <Pin size={11} className="bubble__pin" aria-label="Закреплено" />}
      {message.edited && (
        <button
          type="button"
          className="message__edited message__edited-btn"
          onClick={() => onShowEditHistory?.(message)}
        >
          изменено
        </button>
      )}
      {formatTime(message.timestamp)}
      {message.own && (
        <DeliveryStatus
          status={message.deliveryStatus}
          compact
          onShowReaders={
            onShowReaders ? (anchorRect) => onShowReaders(message, anchorRect) : undefined
          }
        />
      )}
    </span>
  );
}

function MessageContent({
  message,
  onOpenImage,
  onJumpToMessage,
  searchQuery,
  onShowEditHistory,
  onShowReaders,
  onVotePoll,
  formatTime,
  bubble = false,
}: {
  message: MatrixMessage;
  onOpenImage: (state: LightboxState) => void;
  onJumpToMessage?: (messageId: string) => void;
  searchQuery?: string;
  onShowEditHistory?: (message: MatrixMessage) => void;
  onShowReaders?: (message: MatrixMessage, anchorRect: DOMRect) => void;
  onVotePoll?: (messageId: string, answerIds: string[]) => void;
  formatTime?: (timestamp: number) => string;
  bubble?: boolean;
}) {
  // Картинки альбома (или одиночная) для просмотрщика; видео/файлы не входят.
  const lightboxImages = (message.albumMedia ?? (message.media ? [message.media] : []))
    .filter((item) => item.kind === "image")
    .map((item) => ({ url: item.url, name: item.name }));
  const openLightbox = (imageIndex: number) =>
    onOpenImage({
      images: lightboxImages,
      index: imageIndex,
      author: message.own ? "Вы" : message.author,
      time: message.time,
      own: message.own,
    });

  // Заканчивается ли бабл инлайн-текстом (а не медиа/опросом) — тогда время
  // вплывает в правый-нижний угол текста, иначе ставим его отдельной строкой.
  const hasBubbleText =
    message.deleted ||
    (shouldShowText(message) && !message.poll) ||
    (!message.media && !message.albumMedia && !message.poll);

  // Сужаем бабл по тексту, когда время float'ом перенеслось на свою строку.
  const { ref: textRef, hugWidth } = useBubbleTextHug(
    bubble && hasBubbleText && formatTime !== undefined,
    `${message.text ?? ""}|${message.formattedBody ?? ""}|${message.edited}|${message.pinned}|${message.own}|${formatTime ? formatTime(message.timestamp) : ""}`,
  );

  return (
    <div
      className={bubble ? "bubble__text" : "message__text"}
      ref={bubble ? textRef : undefined}
      style={bubble && hugWidth !== null ? { width: hugWidth } : undefined}
    >
      {message.forwardedFrom && (
        <div className="message__forwarded">
          <Forward size={13} />
          <span>
            Переслано от <strong>{message.forwardedFrom}</strong>
          </span>
        </div>
      )}
      {message.replyTo && (
        <button
          type="button"
          className={bubble ? "bubble__reply-preview" : "message__reply-preview"}
          title="Перейти к сообщению"
          onClick={() => onJumpToMessage?.(message.replyTo!.id)}
        >
          <strong>{message.replyTo.author ?? "Сообщение"}</strong>
          <span>{message.replyTo.text ?? "Предыдущее сообщение"}</span>
        </button>
      )}
      {!message.deleted && message.albumMedia && message.albumMedia.length > 0 ? (
        <MessageAlbum media={message.albumMedia} onOpenImageAt={openLightbox} />
      ) : !message.deleted && message.media ? (
        <MessageMedia
          media={message.media}
          onOpen={message.media.kind === "image" ? () => openLightbox(0) : undefined}
        />
      ) : null}
      {!message.deleted && message.poll && onVotePoll && (
        <PollMessage
          poll={message.poll}
          onVote={(answerIds) => onVotePoll(message.id, answerIds)}
        />
      )}
      {message.deleted ? (
        <span className="message__deleted">Сообщение удалено</span>
      ) : shouldShowText(message) && !message.poll ? (
        <MessageBody text={message.text} formattedBody={message.formattedBody} searchQuery={searchQuery} />
      ) : !message.media && !message.albumMedia && !message.poll ? (
        <span className="message__empty">Пустое сообщение</span>
      ) : null}
      {!bubble && message.edited && !message.deleted && (
        <button
          type="button"
          className="message__edited message__edited-btn"
          onClick={() => onShowEditHistory?.(message)}
        >
          (изменено)
        </button>
      )}
      {bubble && formatTime && (
        <BubbleMeta
          message={message}
          formatTime={formatTime}
          variant={hasBubbleText ? "inline" : "block"}
          onShowEditHistory={onShowEditHistory}
          onShowReaders={onShowReaders}
        />
      )}
    </div>
  );
}

function MessageHoverActions({
  message,
  onQuickReply,
  onQuickReact,
}: {
  message: MatrixMessage;
  onQuickReply?: (message: MatrixMessage) => void;
  onQuickReact?: (message: MatrixMessage, key: string) => void;
}) {
  if (message.kind === "system" || message.deleted) return null;
  if (!onQuickReply && !onQuickReact) return null;

  return (
    <div className="message__hover-actions">
      {onQuickReply && (
        <button type="button" title="Ответить" onClick={() => onQuickReply(message)}>
          <Reply size={15} />
        </button>
      )}
      {onQuickReact && (
        <button type="button" title="Реакция" onClick={() => onQuickReact(message, "👍")}>
          <SmilePlus size={15} />
        </button>
      )}
    </div>
  );
}

// Per-user sender name colours (Telegram palette). Own name uses the theme accent.
const SENDER_NAME_PALETTE = [
  "#FC5C51", "#FA790F", "#895DD5", "#0FB297", "#3CA5EC", "#D74B90", "#ED7C0E",
];

function senderNameColor(message: MatrixMessage): string {
  if (message.own) return "var(--color-accent)";
  let hash = 0;
  for (let i = 0; i < message.sender.length; i += 1) {
    hash = (hash * 31 + message.sender.charCodeAt(i)) >>> 0;
  }
  return SENDER_NAME_PALETTE[hash % SENDER_NAME_PALETTE.length];
}

function shouldShowText(message: MatrixMessage): boolean {
  if (!message.text) return false;
  if (!message.media) return true;
  return message.text !== message.media.name;
}
