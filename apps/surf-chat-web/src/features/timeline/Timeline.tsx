import { useEffect, useRef, type SyntheticEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCheck, Forward, Hash } from "lucide-react";
import type { MatrixMessage, MatrixRoomSummary } from "@matrix-platform/matrix-core";
import { fadeUp, transition } from "@matrix-platform/ui";
import { MessageMedia } from "../media/MessageMedia";
import { ReactionPill } from "../reactions/ReactionPill";
import "./timeline.css";

type Props = {
  messages: MatrixMessage[];
  highlightMessageId?: string | null;
  onOpenImage: (src: string) => void;
  onOpenMessageMenu: (message: MatrixMessage, x: number, y: number) => void;
  onToggleReaction: (message: MatrixMessage, key: string) => void;
  room: MatrixRoomSummary;
  view: "flat" | "bubbles";
};

export function Timeline({
  messages,
  highlightMessageId,
  onOpenImage,
  onOpenMessageMenu,
  onToggleReaction,
  room,
  view,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  return (
    <motion.section
      key={room.id}
      className={`timeline${view === "bubbles" ? " timeline--bubbles" : ""}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={transition.base}
    >
      <div className="timeline__spacer" />
      <RoomIntro room={room} />
      {messages.map((message, index) => {
        const previous = messages[index - 1];
        const next = messages[index + 1];
        const startsNewDay = !previous || !isSameDay(previous.timestamp, message.timestamp);
        const compact =
          Boolean(previous) &&
          !startsNewDay &&
          previous.sender === message.sender &&
          message.timestamp - previous.timestamp < 5 * 60 * 1000;
        const groupEnd =
          !next ||
          !isSameDay(next.timestamp, message.timestamp) ||
          next.sender !== message.sender ||
          next.timestamp - message.timestamp >= 5 * 60 * 1000;

        return (
          <motion.div
            key={message.id}
            layout
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            transition={transition.base}
          >
            {startsNewDay && <DayDivider timestamp={message.timestamp} />}
            {view === "bubbles" ? (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ ...transition.base, duration: 0.24 }}
              >
                <BubbleMessage
                  compact={compact}
                  groupEnd={groupEnd}
                  highlighted={message.id === highlightMessageId}
                  message={message}
                  onOpenImage={onOpenImage}
                  onOpenMessageMenu={onOpenMessageMenu}
                  onToggleReaction={onToggleReaction}
                />
              </motion.div>
            ) : (
              <FlatMessage
                compact={compact}
                highlighted={message.id === highlightMessageId}
                message={message}
                onOpenImage={onOpenImage}
                onOpenMessageMenu={onOpenMessageMenu}
                onToggleReaction={onToggleReaction}
              />
            )}
          </motion.div>
        );
      })}
      {messages.length === 0 && <div className="timeline__empty">Сообщений пока нет.</div>}
      <div ref={bottomRef} />
    </motion.section>
  );
}

function FlatMessage({
  compact,
  highlighted,
  message,
  onOpenImage,
  onOpenMessageMenu,
  onToggleReaction,
}: {
  compact: boolean;
  highlighted: boolean;
  message: MatrixMessage;
  onOpenImage: (src: string) => void;
  onOpenMessageMenu: (message: MatrixMessage, x: number, y: number) => void;
  onToggleReaction: (message: MatrixMessage, key: string) => void;
}) {
  return (
    <article
      data-mid={message.id}
      className={`message${compact ? " message--compact" : ""}${highlighted ? " message--highlight" : ""}`}
      onContextMenu={(event) => {
        event.preventDefault();
        onOpenMessageMenu(message, event.clientX, event.clientY);
      }}
    >
      {compact ? (
        <span className="message__avatar message__avatar--spacer" />
      ) : (
        <span className="message__avatar" style={{ background: message.color }}>
          <span className="message__avatar-fallback">{message.author.slice(0, 1).toUpperCase()}</span>
          {message.avatarUrl && <img className="message__avatar-img" src={message.avatarUrl} alt="" onError={hideImage} />}
        </span>
      )}
      <div className="message__body">
        {!compact && (
          <header className="message__head">
            <strong style={{ color: message.color }}>{message.own ? "Вы" : message.author}</strong>
          </header>
        )}
        <MessageContent message={message} onOpenImage={onOpenImage} />
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
      </div>
      <div className="message__aside">
        <time>{message.time}</time>
        {message.own && <CheckCheck size={14} className="message__check" />}
      </div>
    </article>
  );
}

function BubbleMessage({
  compact,
  groupEnd,
  highlighted,
  message,
  onOpenImage,
  onOpenMessageMenu,
  onToggleReaction,
}: {
  compact: boolean;
  groupEnd: boolean;
  highlighted: boolean;
  message: MatrixMessage;
  onOpenImage: (src: string) => void;
  onOpenMessageMenu: (message: MatrixMessage, x: number, y: number) => void;
  onToggleReaction: (message: MatrixMessage, key: string) => void;
}) {
  return (
    <article
      data-mid={message.id}
      className={`mb${message.own ? " mb--own" : ""}${compact ? " mb--cont" : ""}${groupEnd ? " mb--tail" : ""}${highlighted ? " mb--highlight" : ""}`}
      onContextMenu={(event) => {
        event.preventDefault();
        onOpenMessageMenu(message, event.clientX, event.clientY);
      }}
    >
      {!message.own && (
        <span
          className="mb__avatar"
          style={compact ? { visibility: "hidden", background: "transparent" } : { background: message.color }}
        >
          {!compact && (
            <>
              <span className="message__avatar-fallback">{message.author.slice(0, 1).toUpperCase()}</span>
              {message.avatarUrl && <img className="message__avatar-img" src={message.avatarUrl} alt="" onError={hideImage} />}
            </>
          )}
        </span>
      )}
      <div className="bubble">
        {groupEnd && <BubbleTail own={message.own} />}
        {!message.own && !compact && (
          <div className="bubble__author" style={{ color: message.color }}>
            {message.author}
          </div>
        )}
        <MessageContent message={message} onOpenImage={onOpenImage} bubble />
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
        <div className="bubble__time">
          {message.edited && <span className="message__edited">изменено</span>}
          {message.time}
          {message.own && <CheckCheck size={13} />}
        </div>
      </div>
    </article>
  );
}

function MessageContent({
  message,
  onOpenImage,
  bubble = false,
}: {
  message: MatrixMessage;
  onOpenImage: (src: string) => void;
  bubble?: boolean;
}) {
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
          title="Сообщение, на которое отвечают"
        >
          <strong>{message.replyTo.author ?? "Сообщение"}</strong>
          <span>{message.replyTo.text ?? "Предыдущее сообщение"}</span>
        </button>
      )}
      {message.media && <MessageMedia media={message.media} onOpenImage={onOpenImage} />}
      {shouldShowText(message) ? (
        message.text
      ) : !message.media ? (
        <span className="message__empty">Пустое сообщение</span>
      ) : null}
      {!bubble && message.edited && <span className="message__edited">(изменено)</span>}
    </div>
  );
}

function BubbleTail({ own }: { own: boolean }) {
  const path = own
    ? "M1 1C2.4 5.3 4.9 8.7 8.6 11.1C11.2 12.8 14.1 14.1 17 15C11.7 15.2 8.1 14.3 5.7 12.4C3 10.1 1.4 6.3 1 1Z"
    : "M17 1C15.6 5.3 13.1 8.7 9.4 11.1C6.8 12.8 3.9 14.1 1 15C6.3 15.2 9.9 14.3 12.3 12.4C15 10.1 16.6 6.3 17 1Z";

  return (
    <svg
      className={`bubble__tail${own ? " bubble__tail--own" : " bubble__tail--in"}`}
      width="18"
      height="16"
      viewBox="0 0 18 16"
      aria-hidden
    >
      <path d={path} fill="currentColor" />
    </svg>
  );
}

function RoomIntro({ room }: { room: MatrixRoomSummary }) {
  return (
    <div className="timeline__intro">
      <div className="timeline__intro-avatar" style={{ background: room.color }}>
        {room.kind === "channel" ? <Hash size={34} /> : room.name.slice(0, 1).toUpperCase()}
      </div>
      <strong>{room.name}</strong>
      <span>{room.kind === "dm" ? "Начало личного чата" : "Начало канала"}</span>
    </div>
  );
}

function shouldShowText(message: MatrixMessage): boolean {
  if (!message.text) return false;
  if (!message.media) return true;
  return message.text !== message.media.name;
}

function hideImage(event: SyntheticEvent<HTMLImageElement>): void {
  event.currentTarget.style.display = "none";
}

function DayDivider({ timestamp }: { timestamp: number }) {
  return (
    <div className="day-divider">
      <span>{dayLabel(timestamp)}</span>
    </div>
  );
}

function isSameDay(a: number, b: number): boolean {
  return startOfDay(a) === startOfDay(b);
}

function startOfDay(timestamp: number): number {
  const d = new Date(timestamp);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function dayLabel(timestamp: number): string {
  const now = Date.now();
  const diffDays = Math.round((startOfDay(now) - startOfDay(timestamp)) / 86_400_000);
  if (diffDays === 0) return "Сегодня";
  if (diffDays === 1) return "Вчера";

  const d = new Date(timestamp);
  return d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    ...(d.getFullYear() === new Date().getFullYear() ? {} : { year: "numeric" }),
  });
}
