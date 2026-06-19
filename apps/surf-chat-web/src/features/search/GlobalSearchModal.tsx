import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Hash, MessageSquareText, Search, UserRound, X } from "lucide-react";
import {
  colorForId,
  formatDisplayTime,
  type GlobalSearchItem,
  type MatrixRoomSummary,
} from "@matrix-platform/matrix-core";
import { transition } from "@matrix-platform/ui";
import { useMatrix } from "../../app/providers/MatrixContext";
import { searchShortcutLabel } from "../room-list/searchShortcut";
import { useGlobalSearch } from "./useGlobalSearch";
import "./global-search.css";

type Props = {
  open: boolean;
  rooms: MatrixRoomSummary[];
  existingDmUserIds: Array<string | undefined>;
  onClose: () => void;
  onSelectRoom: (roomId: string) => void;
  onSelectUser: (userId: string) => void;
  onSelectMessage: (roomId: string, eventId: string) => void;
};

export function GlobalSearchModal({
  open,
  rooms,
  existingDmUserIds,
  onClose,
  onSelectRoom,
  onSelectUser,
  onSelectMessage,
}: Props) {
  const { client } = useMatrix();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const search = useGlobalSearch({
    client,
    rooms,
    existingDmUserIds,
    open,
  });

  const flatIndexByItem = useMemo(() => {
    const map = new Map<GlobalSearchItem, number>();
    search.items.forEach((item, index) => map.set(item, index));
    return map;
  }, [search.items]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const active = listRef.current?.querySelector<HTMLElement>(".global-search__row.is-active");
    active?.scrollIntoView({ block: "nearest" });
  }, [open, search.activeIndex]);

  const activate = (item: GlobalSearchItem) => {
    if (item.kind === "room") onSelectRoom(item.room.id);
    if (item.kind === "user") onSelectUser(item.user.user_id);
    if (item.kind === "message") onSelectMessage(item.hit.roomId, item.hit.eventId);
  };

  const renderSection = (title: string, sectionItems: GlobalSearchItem[], icon: ReactNode) => {
    if (sectionItems.length === 0) return null;
    return (
      <section className="global-search__section">
        <header className="global-search__section-head">{title}</header>
        {sectionItems.map((item) => {
          const index = flatIndexByItem.get(item) ?? 0;
          const active = index === search.activeIndex;
          return (
            <button
              key={itemKey(item)}
              type="button"
              className={`global-search__row${active ? " is-active" : ""}`}
              onMouseEnter={() => search.setActiveIndex(index)}
              onClick={() => activate(item)}
            >
              <span className="global-search__row-icon">{iconForItem(item, icon)}</span>
              <span className="global-search__row-body">
                {item.kind === "room" && (
                  <>
                    <strong>{item.room.name}</strong>
                    <small>{item.room.kind === "dm" ? "личный чат" : "канал"}</small>
                  </>
                )}
                {item.kind === "user" && (
                  <>
                    <strong>{item.user.display_name ?? item.user.user_id}</strong>
                    <small>{item.user.user_id}</small>
                  </>
                )}
                {item.kind === "message" && (
                  <>
                    <strong>{highlight(item.hit.body, search.query)}</strong>
                    <small>{item.roomName} · {formatDisplayTime(item.hit.timestamp)}</small>
                  </>
                )}
              </span>
            </button>
          );
        })}
      </section>
    );
  };

  if (!open) return null;

  return (
    <motion.div
      className="global-search-overlay"
      onMouseDown={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={transition.fast}
    >
      <motion.section
        className="global-search"
        aria-label="Глобальный поиск"
        onMouseDown={(event) => event.stopPropagation()}
        initial={{ opacity: 0, scale: 0.96, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 18 }}
        transition={transition.base}
      >
        <header className="global-search__head">
          <Search size={18} />
          <input
            ref={inputRef}
            value={search.query}
            placeholder={`Поиск чатов, людей и сообщений (${searchShortcutLabel()})`}
            onChange={(event) => search.setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                search.moveActive(1);
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                search.moveActive(-1);
              }
              if (event.key === "Enter") {
                event.preventDefault();
                if (search.activeItem) activate(search.activeItem);
              }
              if (event.key === "Escape") {
                event.preventDefault();
                onClose();
              }
            }}
          />
          <button type="button" className="global-search__close" title="Закрыть" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div ref={listRef} className="global-search__list">
          {!search.hasQuery && (
            <div className="global-search__hint">
              Начните вводить название чата, @user или текст сообщения
            </div>
          )}

          {search.hasQuery && search.hasRemoteQuery && search.loading && search.items.length === 0 && (
            <div className="global-search__hint">Ищем…</div>
          )}

          {search.hasQuery && !search.loading && search.items.length === 0 && (
            <div className="global-search__hint">Ничего не найдено</div>
          )}

          {renderSection("Чаты", search.sections.roomItems, <Hash size={16} />)}
          {renderSection("Люди", search.sections.userItems, <UserRound size={16} />)}
          {renderSection("Сообщения", search.sections.messageItems, <MessageSquareText size={16} />)}
        </div>
      </motion.section>
    </motion.div>
  );
}

function itemKey(item: GlobalSearchItem): string {
  if (item.kind === "room") return `room:${item.room.id}`;
  if (item.kind === "user") return `user:${item.user.user_id}`;
  return `message:${item.hit.eventId}`;
}

function iconForItem(item: GlobalSearchItem, fallback: ReactNode): ReactNode {
  if (item.kind === "room") {
    return item.room.kind === "channel"
      ? <Hash size={16} />
      : (
        <span className="global-search__avatar" style={{ background: item.room.color }}>
          {item.room.name.slice(0, 1).toUpperCase()}
        </span>
      );
  }
  if (item.kind === "user") {
    const label = item.user.display_name ?? item.user.user_id;
    return (
      <span className="global-search__avatar" style={{ background: colorForId(item.user.user_id) }}>
        {label.slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return fallback;
}

function highlight(text: string, query: string): ReactNode {
  const term = query.trim();
  if (!term) return text;
  const lower = text.toLowerCase();
  const needle = term.toLowerCase();
  const index = lower.indexOf(needle);
  if (index < 0) return text;
  return (
    <>
      {text.slice(0, index)}
      <mark>{text.slice(index, index + term.length)}</mark>
      {text.slice(index + term.length)}
    </>
  );
}
