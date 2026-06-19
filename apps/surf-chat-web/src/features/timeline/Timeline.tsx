import {
  useEffect,
  useLayoutEffect,
  useCallback,
  useRef,
  useState,
  useMemo,
  type SyntheticEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Check, CheckCheck, Clock3, Forward, Hash, MessagesSquare, Reply, SmilePlus } from "lucide-react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import type { MatrixMessage, MatrixRoomSummary } from "@matrix-platform/matrix-core";
import { MessageMedia } from "../media/MessageMedia";
import { MessageBody } from "./MessageBody";
import { PollMessage } from "./PollMessage";
import { ReactionPill } from "../reactions/ReactionPill";
import { MessageSelectMark } from "../selection/MessageSelectMark";
import { BubbleShell } from "./BubbleShell";
import { usePreferences, useTimeFormatter } from "../settings/usePreferences";
import "./timeline.css";
import "./room-timeline-search.css";

type Props = {
  messages: MatrixMessage[];
  highlightMessageId?: string | null;
  /** When set, scrolls the virtualized list to this message (used for search / deep links). */
  scrollToMessageId?: string | null;
  onScrolledToMessage?: (messageId: string) => void;
  onOpenImage: (src: string) => void;
  onOpenMessageMenu: (message: MatrixMessage, x: number, y: number) => void;
  onToggleReaction: (message: MatrixMessage, key: string) => void;
  onOpenThread: (rootId: string) => void;
  onJumpToMessage?: (messageId: string) => void;
  onQuickReply?: (message: MatrixMessage) => void;
  onQuickReact?: (message: MatrixMessage, key: string) => void;
  searchQuery?: string;
  selectionActive?: boolean;
  selectedIds?: Set<string>;
  onMessagePointerClick?: (message: MatrixMessage, event: ReactMouseEvent) => void;
  onToggleSelect?: (messageId: string) => void;
  onShowEditHistory?: (message: MatrixMessage) => void;
  onShowReaders?: (message: MatrixMessage, anchorRect: DOMRect) => void;
  onVotePoll?: (messageId: string, answerIds: string[]) => void;
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
const VIRTUOSO_START_INDEX = 10_000;
// How long a message must stay in view before it counts as read.
const READ_VISIBLE_DELAY = 1000;
// Leave the unread divider a little below the top when opening at first unread.
const UNREAD_SCROLL_OFFSET = 64;

type TimelineItemContext = {
  view: "flat" | "bubbles";
  firstUnreadId?: string | null;
  highlightMessageId?: string | null;
  searchQuery?: string;
  selectionActive: boolean;
  selectedIds?: Set<string>;
  onOpenImage: (src: string) => void;
  onOpenMessageMenu: (message: MatrixMessage, x: number, y: number) => void;
  onToggleReaction: (message: MatrixMessage, key: string) => void;
  onOpenThread: (rootId: string) => void;
  onJumpToMessage?: (messageId: string) => void;
  onQuickReply?: (message: MatrixMessage) => void;
  onQuickReact?: (message: MatrixMessage, key: string) => void;
  onMessagePointerClick?: (message: MatrixMessage, event: ReactMouseEvent) => void;
  onToggleSelect?: (messageId: string) => void;
  onShowEditHistory?: (message: MatrixMessage) => void;
  onShowReaders?: (message: MatrixMessage, anchorRect: DOMRect) => void;
  onVotePoll?: (messageId: string, answerIds: string[]) => void;
  messages: MatrixMessage[];
  firstItemIndex: number;
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

export function Timeline({
  messages,
  highlightMessageId,
  scrollToMessageId,
  onScrolledToMessage,
  onOpenImage,
  onOpenMessageMenu,
  onToggleReaction,
  onOpenThread,
  onJumpToMessage,
  onQuickReply,
  onQuickReact,
  searchQuery,
  selectionActive = false,
  selectedIds,
  onMessagePointerClick,
  onToggleSelect,
  onShowEditHistory,
  onShowReaders,
  onVotePoll,
  onLoadOlder,
  hasOlder = false,
  showIntro = true,
  room,
  view,
  firstUnreadId,
  onReadUpTo,
}: Props) {
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const scrollerElRef = useRef<HTMLElement | null>(null);
  const loadingRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [newMessagesCount, setNewMessagesCount] = useState(0);
  const [firstItemIndex, setFirstItemIndex] = useState(VIRTUOSO_START_INDEX);
  const [atStart, setAtStart] = useState(!hasOlder);
  const leadingMessageIdRef = useRef<string | null>(null);
  const didInit = useRef(false);
  const didUnreadScroll = useRef(false);
  const reachedStart = useRef(false);
  const stick = useRef(true);
  const tailMessageId = useRef<string | null>(null);
  const readTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!hasOlder || !atStart || reachedStart.current) return;
    setAtStart(false);
  }, [atStart, hasOlder]);

  useEffect(() => {
    const leadingId = messages[0]?.id ?? null;
    const previousLeadingId = leadingMessageIdRef.current;
    if (previousLeadingId && leadingId && previousLeadingId !== leadingId) {
      const previousIndex = messages.findIndex((message) => message.id === previousLeadingId);
      if (previousIndex > 0) {
        setFirstItemIndex((value) => value - previousIndex);
      }
    }
    leadingMessageIdRef.current = leadingId;
  }, [messages]);

  const runLoad = useCallback((options: { pages?: number; silent?: boolean; keepBottom?: boolean } = {}) => {
    if (!onLoadOlder || atStart || loadingRef.current) return;

    const pages = options.pages ?? 1;
    const silent = options.silent ?? true;
    if (options.keepBottom) stick.current = true;

    loadingRef.current = true;
    if (!silent) setLoading(true);

    void (async () => {
      for (let page = 0; page < pages; page += 1) {
        const added = await onLoadOlder();
        if (!added) {
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
    if (messages.length === 0) return;
    stick.current = true;
    virtuosoRef.current?.scrollToIndex({
      index: firstItemIndex + messages.length - 1,
      align: "end",
      behavior: "smooth",
    });
    setNewMessagesCount(0);
    const latestMessageId = findLatestReadableMessage(messages)?.id;
    if (latestMessageId) onReadUpTo?.(latestMessageId);
  }, [firstItemIndex, messages, onReadUpTo]);

  useEffect(() => {
    const el = scrollerElRef.current;
    if (!el || atStart || loadingRef.current || !stick.current) return;
    if (el.scrollHeight > el.clientHeight + BOTTOM_THRESHOLD) return;
    runLoad({ keepBottom: true });
  }, [messages.length, atStart, runLoad, room.id]);

  const scrollToMessageById = useCallback((
    messageId: string,
    behavior: "auto" | "smooth" = "smooth",
  ) => {
    const idx = messages.findIndex((message) => message.id === messageId);
    if (idx < 0) return false;

    stick.current = false;
    virtuosoRef.current?.scrollToIndex({
      index: firstItemIndex + idx,
      align: "center",
      behavior,
    });
    return true;
  }, [firstItemIndex, messages]);

  useLayoutEffect(() => {
    if (messages.length === 0 || didInit.current) return;

    if (scrollToMessageId) {
      const targetIndex = messages.findIndex((message) => message.id === scrollToMessageId);
      if (targetIndex >= 0) {
        stick.current = false;
        didUnreadScroll.current = true;
        didInit.current = true;
        requestAnimationFrame(() => {
          scrollToMessageById(scrollToMessageId, "auto");
          onScrolledToMessage?.(scrollToMessageId);
        });
      }
      return;
    }

    if (firstUnreadId && !didUnreadScroll.current) {
      const unreadIndex = messages.findIndex((message) => message.id === firstUnreadId);
      if (unreadIndex >= 0) {
        stick.current = false;
        didUnreadScroll.current = true;
        didInit.current = true;
        requestAnimationFrame(() => {
          virtuosoRef.current?.scrollToIndex({
            index: firstItemIndex + unreadIndex,
            align: "start",
            offset: -UNREAD_SCROLL_OFFSET,
          });
        });
        return;
      }
    }

    const savedDistance = getStoredDistanceFromBottom(room.id);
    requestAnimationFrame(() => {
      if (savedDistance === null || savedDistance < BOTTOM_THRESHOLD) {
        stick.current = true;
        virtuosoRef.current?.scrollToIndex({
          index: firstItemIndex + messages.length - 1,
          align: "end",
        });
      } else {
        stick.current = false;
        virtuosoRef.current?.scrollToIndex({
          index: firstItemIndex + messages.length - 1,
          align: "end",
          offset: -savedDistance,
        });
      }
      didInit.current = true;
    });
  }, [firstItemIndex, firstUnreadId, messages, onScrolledToMessage, room.id, scrollToMessageById, scrollToMessageId]);

  useEffect(() => {
    if (!scrollToMessageId || !didInit.current) return;

    const targetIndex = messages.findIndex((message) => message.id === scrollToMessageId);
    if (targetIndex < 0) return;

    const timer = window.setTimeout(() => {
      if (scrollToMessageById(scrollToMessageId)) {
        onScrolledToMessage?.(scrollToMessageId);
      }
    }, 40);

    return () => window.clearTimeout(timer);
  }, [messages, onScrolledToMessage, scrollToMessageById, scrollToMessageId]);

  useEffect(() => {
    const saveBeforeUnload = () => {
      const el = scrollerElRef.current;
      if (!el) return;
      storeDistanceFromBottom(room.id, el, isNearBottom(el));
    };

    window.addEventListener("beforeunload", saveBeforeUnload);
    return () => window.removeEventListener("beforeunload", saveBeforeUnload);
  }, [room.id]);

  const onReadUpToRef = useRef(onReadUpTo);
  useEffect(() => {
    onReadUpToRef.current = onReadUpTo;
  }, [onReadUpTo]);

  const readableOrder = useMemo(() => {
    const readable = messages.filter((message) => message.kind !== "system");
    return new Map(readable.map((message, index) => [message.id, index]));
  }, [messages]);

  const handleRangeChanged = useCallback(
    (range: { startIndex: number; endIndex: number }) => {
      if (!onReadUpToRef.current) return;
      window.clearTimeout(readTimerRef.current);
      readTimerRef.current = window.setTimeout(() => {
        if (document.visibilityState !== "visible") return;
        let bestIndex = -1;
        let bestId: string | null = null;
        for (let index = range.startIndex; index <= range.endIndex; index += 1) {
          const dataIndex = index - firstItemIndex;
          const message = messages[dataIndex];
          if (!message || message.kind === "system") continue;
          const orderIndex = readableOrder.get(message.id) ?? -1;
          if (orderIndex > bestIndex) {
            bestIndex = orderIndex;
            bestId = message.id;
          }
        }
        if (bestId) onReadUpToRef.current?.(bestId);
      }, READ_VISIBLE_DELAY);
    },
    [firstItemIndex, messages, readableOrder],
  );

  const handleScrollerRef = useCallback((element: HTMLElement | Window | null) => {
    scrollerElRef.current = element instanceof HTMLElement ? element : null;
  }, []);

  useEffect(() => {
    const el = scrollerElRef.current;
    if (!el) return;

    const onScroll = () => {
      const atBottom = isNearBottom(el);
      stick.current = atBottom;
      if (atBottom) setNewMessagesCount(0);
      storeDistanceFromBottom(room.id, el, atBottom);
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [room.id, messages.length]);

  const itemContext = useMemo<TimelineItemContext>(
    () => ({
      view,
      firstUnreadId,
      highlightMessageId,
      searchQuery,
      selectionActive,
      selectedIds,
      onOpenImage,
      onOpenMessageMenu,
      onToggleReaction,
      onOpenThread,
      onJumpToMessage,
      onQuickReply,
      onQuickReact,
      onMessagePointerClick,
      onToggleSelect,
      onShowEditHistory,
      onShowReaders,
      onVotePoll,
      messages,
      firstItemIndex,
    }),
    [
      view,
      firstUnreadId,
      highlightMessageId,
      searchQuery,
      selectionActive,
      selectedIds,
      onOpenImage,
      onOpenMessageMenu,
      onToggleReaction,
      onOpenThread,
      onJumpToMessage,
      onQuickReply,
      onQuickReact,
      onMessagePointerClick,
      onToggleSelect,
      onShowEditHistory,
      onShowReaders,
      onVotePoll,
      messages,
      firstItemIndex,
    ],
  );

  const timelineHeader = useCallback(() => {
    return (
      <>
        {loading && <div className="timeline__loading">Загрузка истории…</div>}
        {atStart && showIntro && <RoomIntro room={room} />}
      </>
    );
  }, [atStart, loading, room, showIntro]);

  const timelineFooter = useCallback(() => {
    if (messages.length > 0) return null;
    return <div className="timeline__empty">Сообщений пока нет.</div>;
  }, [messages.length]);

  return (
    <section
      key={room.id}
      className={`timeline${view === "bubbles" ? " timeline--bubbles" : ""}${selectionActive ? " timeline--selecting" : ""}`}
    >
      <Virtuoso
        ref={virtuosoRef}
        className="timeline__virtuoso"
        data={messages}
        firstItemIndex={firstItemIndex}
        initialTopMostItemIndex={firstItemIndex + Math.max(0, messages.length - 1)}
        alignToBottom
        followOutput={() => (stick.current ? "auto" : false)}
        atBottomThreshold={BOTTOM_THRESHOLD}
        atTopThreshold={TOP_THRESHOLD}
        startReached={() => runLoad()}
        atBottomStateChange={(atBottom) => {
          stick.current = atBottom;
          if (atBottom) setNewMessagesCount(0);
        }}
        rangeChanged={handleRangeChanged}
        scrollerRef={handleScrollerRef}
        computeItemKey={(_, message) => message.id}
        context={itemContext}
        components={{ Header: timelineHeader, Footer: timelineFooter }}
        increaseViewportBy={{ top: 600, bottom: 600 }}
        defaultItemHeight={72}
        itemContent={(index, message, context) =>
          renderTimelineItem(index, message, context as TimelineItemContext)
        }
      />
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

function renderTimelineItem(index: number, message: MatrixMessage, context: TimelineItemContext) {
  const dataIndex = index - context.firstItemIndex;
  const previous = context.messages[dataIndex - 1];
  const next = context.messages[dataIndex + 1];
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
  const selectionMode = context.selectionActive && !isSystem;
  const selected = context.selectedIds?.has(message.id) ?? false;
  const prevSelected =
    selectionMode &&
    Boolean(previous) &&
    previous.kind !== "system" &&
    (context.selectedIds?.has(previous.id) ?? false);
  const nextSelected =
    selectionMode &&
    Boolean(next) &&
    next.kind !== "system" &&
    (context.selectedIds?.has(next.id) ?? false);

  const itemClassName = [
    "timeline__item",
    selectionMode && "timeline__item--selection-mode",
    selected && "timeline__item--selected",
    selected && !prevSelected && "timeline__item--selected-start",
    selected && !nextSelected && "timeline__item--selected-end",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      data-message-id={message.id}
      data-readable-id={isSystem ? undefined : message.id}
      className={itemClassName}
      onClick={
        selectionMode
          ? (event) => context.onMessagePointerClick?.(message, event)
          : undefined
      }
    >
      {selectionMode && <MessageSelectMark selected={selected} />}
      <div className="timeline__item-inner">
        {message.id === context.firstUnreadId && <UnreadDivider />}
        {startsNewDay && <DayDivider timestamp={message.timestamp} />}
        {isSystem ? (
          <SystemMessage message={message} />
        ) : context.view === "bubbles" ? (
          <BubbleMessage
            compact={compact}
            groupEnd={groupEnd}
            highlighted={message.id === context.highlightMessageId}
            message={message}
            onOpenImage={context.onOpenImage}
            onOpenMessageMenu={context.onOpenMessageMenu}
            onToggleReaction={context.onToggleReaction}
            onOpenThread={context.onOpenThread}
            onJumpToMessage={context.onJumpToMessage}
            onQuickReply={context.onQuickReply}
            onQuickReact={context.onQuickReact}
            searchQuery={context.searchQuery}
            selectionActive={context.selectionActive}
            onShowEditHistory={context.onShowEditHistory}
            onShowReaders={context.onShowReaders}
            onVotePoll={context.onVotePoll}
          />
        ) : (
          <FlatMessage
            compact={compact}
            highlighted={message.id === context.highlightMessageId}
            message={message}
            onOpenImage={context.onOpenImage}
            onOpenMessageMenu={context.onOpenMessageMenu}
            onToggleReaction={context.onToggleReaction}
            onOpenThread={context.onOpenThread}
            onJumpToMessage={context.onJumpToMessage}
            onQuickReply={context.onQuickReply}
            onQuickReact={context.onQuickReact}
            searchQuery={context.searchQuery}
            selectionActive={context.selectionActive}
            onShowEditHistory={context.onShowEditHistory}
            onShowReaders={context.onShowReaders}
            onVotePoll={context.onVotePoll}
          />
        )}
      </div>
    </div>
  );
}

function SystemMessage({ message }: { message: MatrixMessage }) {
  const formatTime = useTimeFormatter();
  return (
    <div className="system-message" data-mid={message.id}>
      <span>{message.text}</span>
      <time>{formatTime(message.timestamp)}</time>
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

type MessageRowProps = {
  compact: boolean;
  highlighted: boolean;
  message: MatrixMessage;
  onOpenImage: (src: string) => void;
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

function FlatMessage({
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
          {message.avatarUrl && <img className="message__avatar-img" src={message.avatarUrl} alt="" onError={hideImage} />}
        </span>
      )}
      <div className="message__body">
        {!compact && (
          <header className="message__head">
            <strong style={{ color: message.color }}>{message.own ? "Вы" : message.author}</strong>
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
        <time>{formatTime(message.timestamp)}</time>
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
              {message.avatarUrl && <img className="message__avatar-img" src={message.avatarUrl} alt="" onError={hideImage} />}
            </>
          )}
        </span>
      )}
      <BubbleShell own={message.own} tailed={groupEnd} highlighted={highlighted}>
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

function DeliveryStatus({
  status = "sent",
  compact = false,
  onShowReaders,
}: {
  status?: MatrixMessage["deliveryStatus"];
  compact?: boolean;
  onShowReaders?: (anchorRect: DOMRect) => void;
}) {
  const { preferences } = usePreferences();
  const effectiveStatus = status === "read" && !preferences.showReadReceipts ? "sent" : status;
  const size = compact ? 13 : 14;
  const className = `message__delivery message__delivery--${effectiveStatus}`;
  const canShowReaders = effectiveStatus === "read" && onShowReaders;

  const handleClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (!canShowReaders) return;
    event.stopPropagation();
    onShowReaders(event.currentTarget.getBoundingClientRect());
  };

  const iconProps = {
    size,
    className: className,
  };

  if (canShowReaders) {
    return (
      <button type="button" className="message__delivery-btn" onClick={handleClick} aria-label="Кто прочитал">
        <CheckCheck {...iconProps} />
      </button>
    );
  }

  switch (effectiveStatus) {
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
  onJumpToMessage,
  searchQuery,
  onShowEditHistory,
  onVotePoll,
  bubble = false,
}: {
  message: MatrixMessage;
  onOpenImage: (src: string) => void;
  onJumpToMessage?: (messageId: string) => void;
  searchQuery?: string;
  onShowEditHistory?: (message: MatrixMessage) => void;
  onVotePoll?: (messageId: string, answerIds: string[]) => void;
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
          title="Перейти к сообщению"
          onClick={() => onJumpToMessage?.(message.replyTo!.id)}
        >
          <strong>{message.replyTo.author ?? "Сообщение"}</strong>
          <span>{message.replyTo.text ?? "Предыдущее сообщение"}</span>
        </button>
      )}
      {!message.deleted && message.media && (
        <MessageMedia media={message.media} onOpenImage={onOpenImage} />
      )}
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
      ) : !message.media && !message.poll ? (
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
