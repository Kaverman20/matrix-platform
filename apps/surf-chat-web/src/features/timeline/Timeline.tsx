import { useEffect, useRef } from "react";
import type { MatrixMessage } from "@matrix-platform/matrix-core";
import "./timeline.css";

type Props = {
  messages: MatrixMessage[];
};

export function Timeline({ messages }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  return (
    <section className="timeline">
      <div className="timeline__spacer" />
      {messages.map((message, index) => {
        const previous = messages[index - 1];
        const compact =
          previous &&
          previous.sender === message.sender &&
          message.timestamp - previous.timestamp < 5 * 60 * 1000;

        return (
          <article
            key={message.id}
            className={`message${message.own ? " message--own" : ""}${compact ? " message--compact" : ""}`}
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
                  <strong style={{ color: message.color }}>{message.author}</strong>
                  <time>{message.time}</time>
                </header>
              )}
              <div className="message__text">
                {message.text || <span className="message__empty">Пустое сообщение</span>}
                {message.edited && <span className="message__edited">изменено</span>}
              </div>
            </div>
          </article>
        );
      })}
      {messages.length === 0 && (
        <div className="timeline__empty">Сообщений пока нет.</div>
      )}
      <div ref={bottomRef} />
    </section>
  );
}

