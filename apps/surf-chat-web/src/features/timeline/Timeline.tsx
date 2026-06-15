import {
  useEffect,
  useLayoutEffect,
  useCallback,
  useRef,
  useState,
  type SyntheticEvent,
  type UIEvent,
  type WheelEvent,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Check, CheckCheck, Clock3, Forward, Hash, MessagesSquare } from "lucide-react";
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
  /** First unread message id — renders the "new messages" divider and opens the
   * room scrolled to it. Null/undefined opens at the bottom. */
  firstUnreadId?: string | null;
  /** Called (debounced) with the latest message that has actually scrolled into
   * view, so the read receipt only advances over messages the user has seen. */
  onReadUpTo?: (messageId: string) => void;
};

const TOP_THRESHOLD = 160;
const SCROLL_STORAGE_PREFIX = "surf-chat:room-scroll:";
const BOTTOM_THRESHOLD = 160;
// How long a message must stay in view before it counts as read.
const READ_VISIBLE_DELAY = 1000;
// Leave the unread divider a little below the top when opening at first unread.
const UNREAD_SCROLL_OFFSET = 64;

type ViewportAnchor = {
  id: string;
  top: number;
  fallbackDistanceFromBottom: number;
};

const scrollStorageKey = (roomId: string) => `${SCROLL_STORAGE_PREFIX}${roomId}`;

function getStoredDistanceFromBottom(roomId: string): number | null {
  const raw = window.localStorage.getItem(scrollStorageKey(roomId));
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function storeDistanceFromBottom(roomId: string, el: HTMLElement, pinnedToBottom = false): void {
  if (pinnedToBottom) {
    window.localStorage.setItem(scrollStorageKey(roomId), "0");
    return;
  }

  const distance = Math.max(0, el.scrollHeight - el.scrollTop - el.clientHeight);
  window.localStorage.setItem(scrollStorageKey(roomId), String(Math.round(distance)));
}

function isNearBottom(el: HTMLElement): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_THRESHOLD;
}

function pinToBottom(roomId: string, el: HTMLElement): void {
  el.scrollTop = el.scrollHeight;
  storeDistanceFromBottom(roomId, el, true);
}

function scrollToBottom(roomId: string, el: HTMLElement, behavior: ScrollBehavior = "auto"): void {
  el.scrollTo({ top: el.scrollHeight, behavior });
  storeDistanceFromBottom(roomId, el, true);
}

function captureViewportAnchor(el: HTMLElement): ViewportAnchor | null {
  const viewportTop = el.getBoundingClientRect().top;
  const items = Array.from(
    el.querySelectorAll<HTMLElement>(".timeline__item[data-message-id]"),
  );
  const anchor = items.find((item) => item.getBoundingClientRect().bottom >= viewportTop + 8);
  const id = anchor?.dataset.messageId;
  if (!anchor || !id) return null;

  return {
    id,
    top: anchor.getBoundingClientRect().top,
    fallbackDistanceFromBottom: el.scrollHeight - el.scrollTop,
  };
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
  firstUnreadId,
  onReadUpTo,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [newMessagesCount, setNewMessagesCount] = useState(0);
  // Becomes true once paginating returns no more messages — i.e. we've reached
  // the very start of the room. The component is keyed by room id and remounts
  // on room switch, so this resets automatically per room.
  const [atStart, setAtStart] = useState(!hasOlder);
  const prependAnchor = useRef<ViewportAnchor | null>(null);
  const didInit = useRef(false);
  // One-shot guard for the "open at first unread" scroll. Lets us retry across a
  // render or two — the unread node may not exist on the very first paint if the
  // timeline is still settling. Resets per room (the component is keyed by room).
  const didUnreadScroll = useRef(false);
  // Set once a pagination attempt returns no new messages — i.e. we've genuinely
  // reached the room start. Locks `atStart` so the sync-tick effect below can't
  // flip it back: some homeservers keep handing out a backwards token even at the
  // start of a room (common for DMs), which would otherwise ping-pong atStart and
  // re-trigger endless pagination (the room intro visibly flickers).
  const reachedStart = useRef(false);
  // Whether the view is pinned to the bottom (true until the user scrolls up).
  const stick = useRef(true);
  const tailMessageId = useRef<string | null>(null);

  useEffect(() => {
    if (!hasOlder || !atStart || reachedStart.current) return;
    // hasOlder can become known after the first Matrix sync tick.
    setAtStart(false);
  }, [atStart, hasOlder]);

  const runLoad = useCallback((options: { pages?: number; silent?: boolean; keepBottom?: boolean } = {}) => {
    const el = scrollRef.current;
    if (!el || !onLoadOlder || atStart || loadingRef.current) return;

    const pages = options.pages ?? 1;
    const silent = options.silent ?? true;
    const keepBottom = options.keepBottom ?? false;
    loadingRef.current = true;
    if (!silent) setLoading(true);
    // When filling the viewport on entry we stay pinned to the bottom and let the
    // layout effect keep us there; capturing a prepend anchor would unstick us.
    if (keepBottom) {
      stick.current = true;
    } else {
      prependAnchor.current = captureViewportAnchor(el);
    }

    void (async () => {
      for (let page = 0; page < pages; page += 1) {
        const added = await onLoadOlder();
        if (!added) {
          prependAnchor.current = null;
          reachedStart.current = true;
          setAtStart(true);
          break;
        }
      }
    })().finally(() => {
      loadingRef.current = false;
      if (!silent) setLoading(false);
    });
  }, [atStart, onLoadOlder]);

  useEffect(() => {
    const currentTail = messages.at(-1)?.id ?? null;
    const previousTail = tailMessageId.current;
    tailMessageId.current = currentTail;

    if (!currentTail || !previousTail || currentTail === previousTail) return;

    const previousTailIndex = messages.findIndex((message) => message.id === previousTail);
    if (previousTailIndex === -1) return;

    const appendedCount = messages.length - previousTailIndex - 1;
    if (appendedCount <= 0) return;

    if (stick.current) {
      setNewMessagesCount(0);
      return;
    }

    setNewMessagesCount((count) => count + appendedCount);
  }, [messages]);

  const scrollToLatest = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    stick.current = true;
    scrollToBottom(room.id, el, "smooth");
    setNewMessagesCount(0);
    const latestMessageId = findLatestReadableMessage(messages)?.id;
    if (latestMessageId) onReadUpTo?.(latestMessageId);
  }, [messages, onReadUpTo, room.id]);

  // Telegram-style entry: Matrix's initial sync only delivers a small window of
  // recent events, so a fresh room often has fewer messages than fit on screen.
  // While pinned to the bottom, eagerly paginate until the timeline is scrollable
  // (or we reach the room start) so the chat opens already full of history.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || atStart || loadingRef.current || !stick.current) return;
    const fillsViewport = el.scrollHeight > el.clientHeight + BOTTOM_THRESHOLD;
    if (fillsViewport) return;
    runLoad({ keepBottom: true });
  }, [messages.length, atStart, runLoad, room.id]);

  // Position the view after each render — instantly, never smooth. On scrollback,
  // keep the same message anchored in the same viewport position; this is what
  // stops prepended history from throwing the reader around.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    if (prependAnchor.current) {
      const anchor = prependAnchor.current;
      const node = el.querySelector<HTMLElement>(
        `.timeline__item[data-message-id="${CSS.escape(anchor.id)}"]`,
      );
      if (node) {
        el.scrollTop += node.getBoundingClientRect().top - anchor.top;
      } else {
        el.scrollTop = el.scrollHeight - anchor.fallbackDistanceFromBottom;
      }
      prependAnchor.current = null;
      stick.current = false;
      didInit.current = true;
      return;
    }

    // Open the room at the first unread message (Telegram-style). This may need a
    // render or two until the node exists, so it's a one-shot retry independent of
    // didInit rather than only on the first pass.
    if (firstUnreadId && !didUnreadScroll.current) {
      const unreadNode = el.querySelector<HTMLElement>(
        `.timeline__item[data-message-id="${CSS.escape(firstUnreadId)}"]`,
      );
      if (unreadNode) {
        stick.current = false;
        const offset = unreadNode.getBoundingClientRect().top - el.getBoundingClientRect().top;
        el.scrollTop = Math.max(0, el.scrollTop + offset - UNREAD_SCROLL_OFFSET);
        didUnreadScroll.current = true;
        didInit.current = true;
        return;
      }
    }

    if (!didInit.current) {
      const savedDistance = getStoredDistanceFromBottom(room.id);
      if (savedDistance === null || savedDistance < BOTTOM_THRESHOLD) {
        stick.current = true;
        pinToBottom(room.id, el);
      } else {
        el.scrollTop = Math.max(0, el.scrollHeight - el.clientHeight - savedDistance);
      }
    } else if (stick.current) {
      pinToBottom(room.id, el);
    }
    didInit.current = true;
  }, [messages.length, room.id, firstUnreadId]);

  // Late layout (images decoding, reactions) grows the content after the initial
  // scroll — keep the view glued to the bottom while the user is at the bottom.
  useEffect(() => {
    const content = contentRef.current;
    const el = scrollRef.current;
    if (!content || !el) return;
    const observer = new ResizeObserver(() => {
      if (!prependAnchor.current && stick.current) {
        pinToBottom(room.id, el);
      }
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, [room.id]);

  useEffect(() => {
    const saveBeforeUnload = () => {
      const el = scrollRef.current;
      if (!el) return;
      storeDistanceFromBottom(room.id, el, isNearBottom(el));
    };

    window.addEventListener("beforeunload", saveBeforeUnload);
    return () => window.removeEventListener("beforeunload", saveBeforeUnload);
  }, [room.id]);

  // Read-on-visible: advance the read receipt only over messages that actually
  // scrolled into view and stayed there briefly — not just because the room was
  // opened. Reports the latest currently-visible message; the caller (and the
  // SDK) ignore anything that wouldn't move the receipt forward.
  const onReadUpToRef = useRef(onReadUpTo);
  useEffect(() => {
    onReadUpToRef.current = onReadUpTo;
  }, [onReadUpTo]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !onReadUpToRef.current) return;

    const readableMessages = messages.filter((message) => message.kind !== "system");
    const order = new Map(readableMessages.map((message, index) => [message.id, index]));
    const visible = new Set<string>();
    let timer: number | undefined;

    const flush = () => {
      if (document.visibilityState !== "visible") return;
      let bestIndex = -1;
      let bestId: string | null = null;
      for (const id of visible) {
        const index = order.get(id) ?? -1;
        if (index > bestIndex) {
          bestIndex = index;
          bestId = id;
        }
      }
      if (bestId) onReadUpToRef.current?.(bestId);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.readableId;
          if (!id) continue;
          if (entry.isIntersecting) visible.add(id);
          else visible.delete(id);
        }
        window.clearTimeout(timer);
        timer = window.setTimeout(flush, READ_VISIBLE_DELAY);
      },
      { root: el, threshold: 0.6 },
    );

    el.querySelectorAll<HTMLElement>(".timeline__item[data-readable-id]").forEach((node) =>
      observer.observe(node),
    );

    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [messages, room.id]);

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const el = event.currentTarget;
    stick.current = isNearBottom(el);
    if (stick.current) setNewMessagesCount(0);
    storeDistanceFromBottom(room.id, el, stick.current);
    if (el.scrollTop <= TOP_THRESHOLD) runLoad();
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (event.deltaY >= 0) return;
    const el = event.currentTarget;
    if (el.scrollTop <= TOP_THRESHOLD) runLoad();
  };

  return (
    <section
      key={room.id}
      ref={scrollRef}
      onScroll={handleScroll}
      onWheel={handleWheel}
      className={`timeline${view === "bubbles" ? " timeline--bubbles" : ""}`}
    >
      <div className="timeline__spacer" />
      <div className="timeline__content" ref={contentRef}>
      {loading && <div className="timeline__loading">Загрузка истории…</div>}
      {atStart && showIntro && <RoomIntro room={room} />}
      {messages.map((message, index) => {
        const previous = messages[index - 1];
        const next = messages[index + 1];
        const startsNewDay = !previous || !isSameDay(previous.timestamp, message.timestamp);
        const isSystem = message.kind === "system";
        const compact =
          !isSystem &&
          Boolean(previous) &&
          previous.kind !== "system" &&
          !startsNewDay &&
          previous.sender === message.sender &&
          message.timestamp - previous.timestamp < 5 * 60 * 1000;
        const groupEnd =
          isSystem ||
          !next ||
          next.kind === "system" ||
          !isSameDay(next.timestamp, message.timestamp) ||
          next.sender !== message.sender ||
          next.timestamp - message.timestamp >= 5 * 60 * 1000;

        return (
          <div
            key={message.id}
            data-message-id={message.id}
            data-readable-id={isSystem ? undefined : message.id}
            className="timeline__item"
          >
            <div className="timeline__item-inner">
            {message.id === firstUnreadId && <UnreadDivider />}
            {startsNewDay && <DayDivider timestamp={message.timestamp} />}
            {isSystem ? (
              <SystemMessage message={message} />
            ) : view === "bubbles" ? (
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
      {messages.length === 0 && <div className="timeline__empty">Сообщений пока нет.</div>}
      </div>
      <AnimatePresence initial={false}>
        {newMessagesCount > 0 && (
          <motion.button
            type="button"
            className="timeline__new-messages"
            onClick={scrollToLatest}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.16 }}
          >
            {newMessagesLabel(newMessagesCount)}
          </motion.button>
        )}
      </AnimatePresence>
    </section>
  );
}

function SystemMessage({ message }: { message: MatrixMessage }) {
  return (
    <div className="system-message" data-mid={message.id}>
      <span>{message.text}</span>
      <time>{message.time}</time>
    </div>
  );
}

function findLatestReadableMessage(messages: MatrixMessage[]): MatrixMessage | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.kind !== "system") return message;
  }
  return undefined;
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
        {message.own && <DeliveryStatus status={message.deliveryStatus} />}
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
          {message.own && <DeliveryStatus status={message.deliveryStatus} compact />}
        </div>
      </div>
    </article>
  );
}

function DeliveryStatus({
  status = "sent",
  compact = false,
}: {
  status?: MatrixMessage["deliveryStatus"];
  compact?: boolean;
}) {
  const size = compact ? 13 : 14;
  const className = `message__delivery message__delivery--${status}`;

  switch (status) {
    case "sending":
      return <Clock3 size={size} className={className} aria-label="Отправляется" />;
    case "read":
      return <CheckCheck size={size} className={className} aria-label="Прочитано" />;
    case "error":
      return <AlertCircle size={size} className={className} aria-label="Ошибка отправки" />;
    case "sent":
    default:
      return <Check size={size} className={className} aria-label="Отправлено" />;
  }
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

function UnreadDivider() {
  return (
    <div className="unread-divider">
      <span>Новые сообщения</span>
    </div>
  );
}

function newMessagesLabel(count: number): string {
  if (count === 1) return "1 новое сообщение";
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${count} новых сообщения`;
  }
  return `${count} новых сообщений`;
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
