import type { MouseEvent as ReactMouseEvent } from "react";
import type { MatrixMessage } from "@matrix-platform/matrix-core";
import type { LightboxState } from "../media/Lightbox";
import { MessageSelectMark } from "../selection/MessageSelectMark";
import { SystemMessage } from "./SystemMessage";
import { BubbleMessage, FlatMessage } from "./MessageRow";
import { DayDivider, UnreadDivider } from "./Dividers";
import { isSameDay } from "./timelineDates";

export type TimelineItemContext = {
  view: "flat" | "bubbles";
  firstUnreadId?: string | null;
  highlightMessageId?: string | null;
  searchQuery?: string;
  selectionActive: boolean;
  selectedIds?: Set<string>;
  onOpenImage: (state: LightboxState) => void;
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

export function renderTimelineItem(index: number, message: MatrixMessage, context: TimelineItemContext) {
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
