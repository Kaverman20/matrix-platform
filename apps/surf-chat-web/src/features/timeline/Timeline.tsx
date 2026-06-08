import { useEffect, useRef } from "react";
import { Forward } from "lucide-react";
import type { MatrixMessage } from "@matrix-platform/matrix-core";
import { MessageMedia } from "../media/MessageMedia";
import { ReactionPill } from "../reactions/ReactionPill";
import "./timeline.css";

type Props = {
  messages: MatrixMessage[];
  onOpenImage: (src: string) => void;
  onOpenMessageMenu: (message: MatrixMessage, x: number, y: number) => void;
  onToggleReaction: (message: MatrixMessage, key: string) => void;
};

export function Timeline({
  messages,
  onOpenImage,
  onOpenMessageMenu,
  onToggleReaction,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  return (
    <section className="timeline">
      <div className="timeline__spacer" />
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
          <div key={message.id}>
            {startsNewDay && <DayDivider timestamp={message.timestamp} />}
            <article
              className={`message${message.own ? " message--own" : ""}${compact ? " message--compact" : ""}${groupEnd ? " message--group-end" : ""}`}
              onContextMenu={(event) => {
                event.preventDefault();
                onOpenMessageMenu(message, event.clientX, event.clientY);
              }}
            >
              <span
                className="message__avatar"
                style={compact ? { visibility: "hidden" } : { background: message.color }}
              >
                {!compact && message.author.slice(0, 1).toUpperCase()}
              </span>
              <div className="message__body">
                {!compact && (
                  <header className="message__head">
                    <strong style={{ color: message.own ? "var(--color-accent)" : message.color }}>
                      {message.own ? "Вы" : message.author}
                    </strong>
                    <time>{message.time}</time>
                  </header>
                )}
                <div className="message__text">
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
                      className="message__reply-preview"
                      title="Сообщение, на которое отвечают"
                    >
                      <strong>{message.replyTo.author ?? "Сообщение"}</strong>
                      <span>{message.replyTo.text ?? "Предыдущее сообщение"}</span>
                    </button>
                  )}
                  {message.media && (
                    <MessageMedia media={message.media} onOpenImage={onOpenImage} />
                  )}
                  {shouldShowText(message) ? (
                    message.text
                  ) : !message.media ? (
                    <span className="message__empty">Пустое сообщение</span>
                  ) : null}
                  {message.edited && <span className="message__edited">изменено</span>}
                  {compact && <time className="message__inline-time">{message.time}</time>}
                </div>
                {message.reactions.length > 0 && (
                  <div className="message__reactions">
                    {message.reactions.map((reaction) => (
                      <ReactionPill
                        key={reaction.key}
                        reaction={reaction}
                        onToggle={() => onToggleReaction(message, reaction.key)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </article>
          </div>
        );
      })}
      {messages.length === 0 && (
        <div className="timeline__empty">Сообщений пока нет.</div>
      )}
      <div ref={bottomRef} />
    </section>
  );
}

function shouldShowText(message: MatrixMessage): boolean {
  if (!message.text) return false;
  if (!message.media) return true;
  return message.text !== message.media.name;
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
