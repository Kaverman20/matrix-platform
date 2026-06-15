import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type SyntheticEvent,
  type UIEvent,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCheck, Forward, Hash, MessagesSquare } from "lucide-react";
import type { MatrixMessage, MatrixRoomSummary } from "@matrix-platform/matrix-core";
import { MessageMedia } from "../media/MessageMedia";
import { ReactionPill } from "../reactions/ReactionPill";
import "./timeline.css";

type Props = {
  messages: MatrixMessage[];
  highlightMessageId?: string | null;
  onOpenImage: (src: string) => void;
  onOpenMessageMenu: (message: MatrixMessage, x: number, y: number) => void;
  onToggleReaction: (message: MatrixMessage, key: string) => void;
  onOpenThread: (rootId: string) => void;
  onLoadOlder?: () => Promise<boolean>;
  hasOlder?: boolean;
  showIntro?: boolean;
  room: MatrixRoomSummary;
  view: "flat" | "bubbles";
};

const TOP_THRESHOLD = 160;
const HISTORY_PREFETCH_PAGES = 2;
const SCROLL_STORAGE_PREFIX = "surf-chat:room-scroll:";

const scrollStorageKey = (roomId: string) => `${SCROLL_STORAGE_PREFIX}${roomId}`;

function getStoredDistanceFromBottom(roomId: string): number | null {
  const raw = window.localStorage.getItem(scrollStorageKey(roomId));
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function storeDistanceFromBottom(roomId: string, el: HTMLElement): void {
  const distance = Math.max(0, el.scrollHeight - el.scrollTop - el.clientHeight);
  window.localStorage.setItem(scrollStorageKey(roomId), String(Math.round(distance)));
}

export function Timeline({
  messages,
  highlightMessageId,
  onOpenImage,
  onOpenMessageMenu,
  onToggleReaction,
  onOpenThread,
  onLoadOlder,
  hasOlder = false,
  showIntro = true,
  room,
  view,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const [loading, setLoading] = useState(false);
  // Becomes true once paginating returns no more messages — i.e. we've reached
  // the very start of the room. The component is keyed by room id and remounts
  // on room switch, so this resets automatically per room.
  const [atStart, setAtStart] = useState(!hasOlder);
  // Distance from the bottom captured before a scrollback load, so we can
  // restore the viewport once older messages are prepended.
  const restoreFromBottom = useRef<number | null>(null);
  const didInit = useRef(false);
  // Whether the view is pinned to the bottom (true until the user scrolls up).
  const stick = useRef(true);
  // TanStack Virtual manages scroll measurement internally; this hook is expected here.
  // eslint-disable-next-line react-hooks/incompatible-library
  const rowVirtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => (view === "bubbles" ? 78 : 70),
    getItemKey: (index) => messages[index]?.id ?? index,
    overscan: 18,
  });
  const virtualItems = rowVirtualizer.getVirtualItems();

  const runLoad = (options: { pages?: number; silent?: boolean } = {}) => {
    const el = scrollRef.current;
    if (!el || !onLoadOlder || atStart || loadingRef.current) return;

    const pages = options.pages ?? 1;
    const silent = options.silent ?? false;
    loadingRef.current = true;
    if (!silent) setLoading(true);
    restoreFromBottom.current = el.scrollHeight - el.scrollTop;

    void (async () => {
      for (let page = 0; page < pages; page += 1) {
        const added = await onLoadOlder();
        if (!added) {
          restoreFromBottom.current = null;
          setAtStart(true);
          break;
        }
      }
    })().finally(() => {
      loadingRef.current = false;
      if (!silent) setLoading(false);
    });
  };

  // Position the view after each render — instantly, never smooth, so entry and
  // new messages don't jitter. On scrollback, restore the prior offset; on first
  // mount, restore the last known distance from the bottom when possible.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    if (restoreFromBottom.current !== null) {
      el.scrollTop = el.scrollHeight - restoreFromBottom.current;
      restoreFromBottom.current = null;
    } else if (!didInit.current) {
      const savedDistance = getStoredDistanceFromBottom(room.id);
      el.scrollTop = savedDistance === null
        ? el.scrollHeight
        : Math.max(0, el.scrollHeight - el.clientHeight - savedDistance);
    } else if (stick.current) {
      el.scrollTop = el.scrollHeight;
    }
    didInit.current = true;
  }, [messages.length, room.id, rowVirtualizer]);

  // Late layout (images decoding, reactions) grows the content after the initial
  // scroll — keep the view glued to the bottom while the user is at the bottom.
  useEffect(() => {
    const content = contentRef.current;
    const el = scrollRef.current;
    if (!content || !el) return;
    const observer = new ResizeObserver(() => {
      if (restoreFromBottom.current === null && stick.current) {
        el.scrollTop = el.scrollHeight;
      }
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  // Prepare a little older history after the latest messages are visible. This
  // keeps first paint fast while reducing "hit loading" moments during the
  // first upward scroll. It only runs while the user is still at the bottom.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || atStart || loadingRef.current || !onLoadOlder || messages.length === 0) return;

    const timer = window.setTimeout(() => {
      if (!stick.current) return;
      runLoad({ pages: HISTORY_PREFETCH_PAGES, silent: true });
    }, 450);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.id]);

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const el = event.currentTarget;
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    storeDistanceFromBottom(room.id, el);
    if (el.scrollTop <= TOP_THRESHOLD) runLoad();
  };

  return (
    <section
      key={room.id}
      ref={scrollRef}
      onScroll={handleScroll}
      className={`timeline${view === "bubbles" ? " timeline--bubbles" : ""}`}
    >
      <div className="timeline__spacer" />
      <div className="timeline__content" ref={contentRef}>
      {loading && <div className="timeline__loading">Загрузка истории…</div>}
      {atStart && showIntro && <RoomIntro room={room} />}
      <div
        className="timeline__virtual"
        style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
      >
      {virtualItems.map((virtualItem) => {
        const index = virtualItem.index;
        const message = messages[index];
        if (!message) return null;

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

        const enterIndex = Math.min(index, 14);

        return (
          <div
            key={message.id}
            ref={rowVirtualizer.measureElement}
            data-index={virtualItem.index}
            className="timeline__item"
            style={{
              "--enter-index": enterIndex,
              transform: `translateY(${virtualItem.start}px)`,
            } as CSSProperties}
          >
            <div className="timeline__item-inner">
            {startsNewDay && <DayDivider timestamp={message.timestamp} />}
            {view === "bubbles" ? (
              <BubbleMessage
                compact={compact}
                groupEnd={groupEnd}
                highlighted={message.id === highlightMessageId}
                message={message}
                onOpenImage={onOpenImage}
                onOpenMessageMenu={onOpenMessageMenu}
                onToggleReaction={onToggleReaction}
                onOpenThread={onOpenThread}
              />
            ) : (
              <FlatMessage
                compact={compact}
                highlighted={message.id === highlightMessageId}
                message={message}
                onOpenImage={onOpenImage}
                onOpenMessageMenu={onOpenMessageMenu}
                onToggleReaction={onToggleReaction}
                onOpenThread={onOpenThread}
              />
            )}
            </div>
          </div>
        );
      })}
      </div>
      {messages.length === 0 && <div className="timeline__empty">Сообщений пока нет.</div>}
      </div>
    </section>
  );
}

function FlatMessage({
  compact,
  highlighted,
  message,
  onOpenImage,
  onOpenMessageMenu,
  onToggleReaction,
  onOpenThread,
}: {
  compact: boolean;
  highlighted: boolean;
  message: MatrixMessage;
  onOpenImage: (src: string) => void;
  onOpenMessageMenu: (message: MatrixMessage, x: number, y: number) => void;
  onToggleReaction: (message: MatrixMessage, key: string) => void;
  onOpenThread: (rootId: string) => void;
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
        {message.thread && <ThreadChip message={message} onOpenThread={onOpenThread} />}
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
  onOpenThread,
}: {
  compact: boolean;
  groupEnd: boolean;
  highlighted: boolean;
  message: MatrixMessage;
  onOpenImage: (src: string) => void;
  onOpenMessageMenu: (message: MatrixMessage, x: number, y: number) => void;
  onToggleReaction: (message: MatrixMessage, key: string) => void;
  onOpenThread: (rootId: string) => void;
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
        {message.thread && <ThreadChip message={message} onOpenThread={onOpenThread} />}
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

function ThreadChip({
  message,
  onOpenThread,
}: {
  message: MatrixMessage;
  onOpenThread: (rootId: string) => void;
}) {
  const thread = message.thread;
  if (!thread) return null;

  return (
    <button
      type="button"
      className={`thread-chip${thread.unread ? " thread-chip--unread" : ""}`}
      onClick={() => onOpenThread(message.id)}
    >
      <MessagesSquare size={14} />
      <span>{repliesLabel(thread.count)}</span>
      {thread.lastAuthor && <em>· {thread.lastAuthor}</em>}
    </button>
  );
}

function repliesLabel(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} ответ`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} ответа`;
  return `${count} ответов`;
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
