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
          onVotePoll={onVotePoll}
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
        <div className="bubble__time">
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
                onShowReaders
                  ? (anchorRect) => onShowReaders(message, anchorRect)
                  : undefined
              }
            />
          )}
        </div>
      </BubbleShell>
    </article>
  );
}

function MessageContent({
  message,
  onOpenImage,
  onJumpToMessage,
  searchQuery,
  onShowEditHistory,
  onVotePoll,
  bubble = false,
}: {
  message: MatrixMessage;
  onOpenImage: (state: LightboxState) => void;
  onJumpToMessage?: (messageId: string) => void;
  searchQuery?: string;
  onShowEditHistory?: (message: MatrixMessage) => void;
  onVotePoll?: (messageId: string, answerIds: string[]) => void;
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

  return (
    <div className={bubble ? "bubble__text" : "message__text"}>
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
