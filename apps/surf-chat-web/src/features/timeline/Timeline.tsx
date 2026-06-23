import {
  useEffect,
  useLayoutEffect,
  useCallback,
  useRef,
  useState,
  useMemo,
  forwardRef,
  useImperativeHandle,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import type { RefObject, MutableRefObject } from "react";
import type { MatrixMessage, MatrixRoomSummary } from "@matrix-platform/matrix-core";
import type { LightboxState } from "../media/Lightbox";
import { RoomIntro } from "./RoomIntro";
import { renderTimelineItem, type TimelineItemContext } from "./renderTimelineItem";
import { isMessageNodeVisible } from "./jumpToMessage";
import {
  BOTTOM_THRESHOLD,
  getStoredDistanceFromBottom,
  isNearBottom,
  storeDistanceFromBottom,
} from "./timelineScroll";
import "./timeline.css";
import "./room-timeline-search.css";

export type TimelineHandle = {
  /** Scroll the virtualized list to a message already present in `messages`. */
  scrollToMessage: (messageId: string) => boolean;
};

type ScrollToMessageParams = {
  virtuosoRef: RefObject<VirtuosoHandle | null>;
  scrollerElRef: RefObject<HTMLElement | null>;
  messageId: string;
  absoluteIndex: number;
  onDone?: (messageId: string) => void;
};

/**
 * Drive the virtualized list to a message and confirm it's actually on screen,
 * retrying across frames while Virtuoso renders the freshly loaded window.
 */
function runScrollToMessage({
  virtuosoRef,
  scrollerElRef,
  messageId,
  absoluteIndex,
  onDone,
}: ScrollToMessageParams): () => void {
  let cancelled = false;
  let attempts = 0;
  let frameId = 0;
  let done = false;

  const finish = () => {
    if (done) return;
    done = true;
    onDone?.(messageId);
  };

  const tick = () => {
    if (cancelled) return;
    attempts += 1;

    // Плавный перенос к сообщению (как в Telegram) только на первом кадре —
    // на ретраях после подгрузки уже мгновенно, чтобы не дёргать анимацию.
    virtuosoRef.current?.scrollToIndex({
      index: absoluteIndex,
      align: "center",
      behavior: attempts === 1 ? "smooth" : "auto",
    });

    const scroller = scrollerElRef.current;
    const node = scroller?.querySelector<HTMLElement>(
      `[data-mid="${CSS.escape(messageId)}"]`,
    );
    if (node?.dataset.mid === messageId && isMessageNodeVisible(node)) {
      finish();
      return;
    }

    if (attempts < 24) {
      frameId = requestAnimationFrame(tick);
    } else {
      finish();
    }
  };

  frameId = requestAnimationFrame(tick);
  return () => {
    cancelled = true;
    cancelAnimationFrame(frameId);
  };
}

type Props = {
  messages: MatrixMessage[];
  highlightMessageId?: string | null;
  onOpenImage: (state: LightboxState) => void;
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
  /** True while jumping to a message loads history — shows a "Переход…" hint. */
  historyLoading?: boolean;
  /** When the room opens already anchored on a message (jump snapshot), scroll
   * to it on mount instead of opening at the bottom / first unread. */
  initialScrollToMessageId?: string | null;
  /** Re-scroll to an already-loaded message; bump `seq` to re-trigger. */
  scrollToMessageRequest?: { id: string; seq: number } | null;
  onScrollToMessageDone?: (messageId: string) => void;
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
const VIRTUOSO_START_INDEX = 10_000;
// How long a message must stay in view before it counts as read.
const READ_VISIBLE_DELAY = 1000;
// Leave the unread divider a little below the top when opening at first unread.
const UNREAD_SCROLL_OFFSET = 64;

/** Virtuoso index for a data row, accounting for a pending prepend anchor shift. */
function effectiveFirstItemIndex(
  messages: MatrixMessage[],
  firstItemIndex: number,
  leadingMessageIdRef: MutableRefObject<string | null>,
): number {
  const leadingId = messages[0]?.id ?? null;
  const previousLeadingId = leadingMessageIdRef.current;
  if (!previousLeadingId || !leadingId || previousLeadingId === leadingId) {
    return firstItemIndex;
  }

  const previousIndex = messages.findIndex((message) => message.id === previousLeadingId);
  return previousIndex > 0 ? firstItemIndex - previousIndex : firstItemIndex;
}

function resolveInitialTopMostIndex(
  messages: MatrixMessage[],
  firstItemIndex: number,
  scrollToMessageRequest: Props["scrollToMessageRequest"],
  initialScrollToMessageId: Props["initialScrollToMessageId"],
): number {
  const scrollId = scrollToMessageRequest?.id ?? initialScrollToMessageId ?? null;
  if (scrollId) {
    const targetIndex = messages.findIndex((message) => message.id === scrollId);
    if (targetIndex >= 0) return firstItemIndex + targetIndex;
  }
  return firstItemIndex + Math.max(0, messages.length - 1);
}

export const Timeline = forwardRef<TimelineHandle, Props>(function Timeline({
  messages,
  highlightMessageId,
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
  historyLoading = false,
  initialScrollToMessageId,
  scrollToMessageRequest,
  onScrollToMessageDone,
  room,
  view,
  firstUnreadId,
  onReadUpTo,
}: Props, ref) {
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
  const initialTopMostItemIndexRef = useRef(
    resolveInitialTopMostIndex(messages, VIRTUOSO_START_INDEX, scrollToMessageRequest, initialScrollToMessageId),
  );

  useImperativeHandle(ref, () => ({
    scrollToMessage: (messageId: string) => {
      const idx = messages.findIndex((message) => message.id === messageId);
      if (idx < 0) return false;
      stick.current = false;
      const baseIndex = effectiveFirstItemIndex(messages, firstItemIndex, leadingMessageIdRef);
      virtuosoRef.current?.scrollToIndex({
        index: baseIndex + idx,
        align: "center",
        behavior: "smooth",
      });
      return true;
    },
  }), [messages, firstItemIndex]);

  useEffect(() => {
    if (!hasOlder || !atStart || reachedStart.current) return;
    setAtStart(false);
  }, [atStart, hasOlder]);

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

  useLayoutEffect(() => {
    if (messages.length === 0 || didInit.current) return;

    // Если уже есть запрос скролла к конкретному сообщению (jump к закрепу/реплаю
    // сразу после выхода из snapshot и remount) — отдаём скролл ему, не уводим
    // в самый низ. Иначе дефолтное позиционирование перебивало бы jump.
    if (scrollToMessageRequest) {
      didInit.current = true;
      return;
    }

    if (initialScrollToMessageId) {
      const targetIndex = messages.findIndex((message) => message.id === initialScrollToMessageId);
      if (targetIndex >= 0) {
        stick.current = false;
        didInit.current = true;
        const messageId = initialScrollToMessageId;
        return runScrollToMessage({
          virtuosoRef,
          scrollerElRef,
          messageId,
          absoluteIndex: effectiveFirstItemIndex(messages, firstItemIndex, leadingMessageIdRef) + targetIndex,
          onDone: onScrollToMessageDone,
        });
      }
      // Window still loading — don't fall through to bottom scroll.
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
  }, [firstItemIndex, firstUnreadId, initialScrollToMessageId, messages, onScrollToMessageDone, room.id, scrollToMessageRequest]);

  useLayoutEffect(() => {
    if (!scrollToMessageRequest) return;

    const messageId = scrollToMessageRequest.id;
    const targetIndex = messages.findIndex((message) => message.id === messageId);
    if (targetIndex < 0) return;

    stick.current = false;
    const baseIndex = effectiveFirstItemIndex(messages, firstItemIndex, leadingMessageIdRef);
    return runScrollToMessage({
      virtuosoRef,
      scrollerElRef,
      messageId,
      absoluteIndex: baseIndex + targetIndex,
      onDone: onScrollToMessageDone,
    });
  }, [firstItemIndex, messages, onScrollToMessageDone, scrollToMessageRequest]);

  // Anchor shift when history prepends — runs after scroll-to-message layout effects
  // so `effectiveFirstItemIndex` can still see the previous leading id.
  useLayoutEffect(() => {
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

  // Keep the latest message visible when the scroller shrinks (the composer
  // grows as you type a long message, the window resizes, …) — Telegram-style.
  // Only re-pins when the user is already at the bottom.
  useEffect(() => {
    const el = scrollerElRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    const pinToBottom = () => {
      if (messages.length === 0) return;
      if (!stick.current && !isNearBottom(el)) return;
      // Reading scrollHeight forces a synchronous reflow, so the bottom spacer's
      // new --composer-h height is already applied when we set scrollTop — the
      // last message tracks the composer in the SAME frame (no Safari lag).
      el.scrollTop = el.scrollHeight;
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    };
    // The composer dispatches this synchronously when it grows/shrinks (typing,
    // reply bar, etc.) — re-pin immediately instead of waiting on a chain of
    // ResizeObservers, which lags by several frames in Safari.
    const onComposerResize = () => pinToBottom();
    window.addEventListener("surf-composer-resize", onComposerResize);

    // Still re-pin on window resize (scroller shrinks) — gated inside pinToBottom.
    const observer =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => pinToBottom()) : null;
    observer?.observe(el);

    return () => {
      window.removeEventListener("surf-composer-resize", onComposerResize);
      observer?.disconnect();
    };
  }, [firstItemIndex, messages.length, room.id]);

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
        {(loading || historyLoading) && (
          <div className="timeline__loading">
            {historyLoading ? "Переход к сообщению…" : "Загрузка истории…"}
          </div>
        )}
        {atStart && showIntro && <RoomIntro room={room} />}
      </>
    );
  }, [atStart, historyLoading, loading, room, showIntro]);

  const timelineFooter = useCallback(() => {
    if (messages.length === 0) return <div className="timeline__empty">Сообщений пока нет.</div>;
    // Reliable breathing room below the last message (a scroller padding-bottom
    // is ignored by Safari/WebKit; a real footer element inside the list isn't).
    return <div className="timeline__bottom-spacer" aria-hidden />;
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
        initialTopMostItemIndex={initialTopMostItemIndexRef.current}
        alignToBottom
        followOutput={() =>
          stick.current && !scrollToMessageRequest && !initialScrollToMessageId ? "auto" : false
        }
        atBottomThreshold={BOTTOM_THRESHOLD}
        atTopThreshold={TOP_THRESHOLD}
        startReached={() => runLoad()}
        atBottomStateChange={(atBottom) => {
          // Only (re-)stick when we actually reach the bottom. Don't UN-stick
          // here: shrinking the viewport (composer grows) makes Virtuoso report
          // "not at bottom" even though the user hasn't scrolled — unsticking
          // then would defeat the resize re-pin and hide the latest message.
          // Genuine scroll-away is handled by the scroll listener.
          if (atBottom) {
            stick.current = true;
            setNewMessagesCount(0);
          }
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
});

function findLatestReadableMessage(messages: MatrixMessage[]): MatrixMessage | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.kind !== "system") return message;
  }
  return undefined;
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
