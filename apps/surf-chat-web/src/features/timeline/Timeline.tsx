import { useEffect, useRef } from "react";
import { Pencil, Reply } from "lucide-react";
import type { MatrixMessage } from "@matrix-platform/matrix-core";
import "./timeline.css";

type Props = {
  messages: MatrixMessage[];
  onEditMessage: (message: MatrixMessage) => void;
  onReplyMessage: (message: MatrixMessage) => void;
};

export function Timeline({ messages, onEditMessage, onReplyMessage }: Props) {
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
                  {message.text || <span className="message__empty">Пустое сообщение</span>}
                  {message.edited && <span className="message__edited">изменено</span>}
                  {compact && <time className="message__inline-time">{message.time}</time>}
                </div>
                <div className="message__actions" aria-label="Действия с сообщением">
                  <button type="button" onClick={() => onReplyMessage(message)} title="Ответить">
                    <Reply size={15} />
                  </button>
                  {message.own && (
                    <button type="button" onClick={() => onEditMessage(message)} title="Редактировать">
                      <Pencil size={14} />
                    </button>
                  )}
                </div>
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
