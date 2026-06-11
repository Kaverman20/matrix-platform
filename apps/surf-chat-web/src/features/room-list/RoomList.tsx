import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, Reorder } from "framer-motion";
import { ChevronDown, ChevronLeft, ChevronRight, Hash, MessageCircle, PanelLeftClose, PanelLeftOpen, Plus, Search, Star, UserPlus } from "lucide-react";
import type { MatrixRoomSummary, MatrixSpaceSummary } from "@matrix-platform/matrix-core";
import { fadeUp, transition } from "@matrix-platform/ui";
import { AuthedImage } from "../media/AuthedImage";
import "./room-list.css";

type Props = {
  favourites: MatrixRoomSummary[];
  channels: MatrixRoomSummary[];
  dms: MatrixRoomSummary[];
  activeRoomId: string | null;
  collapsed: boolean;
  activeSpaceId: string | null;
  subspaces: MatrixSpaceSummary[];
  parentSpaceName: string | null;
  onBack: () => void;
  onSelectSpace: (spaceId: string) => void;
  onToggleCollapsed: () => void;
  onSelectRoom: (roomId: string) => void;
  onToggleFavourite: (roomId: string) => void;
  onReorderFavourites: (rooms: MatrixRoomSummary[]) => void;
  onCreateChannel: () => void;
  onCreateDm: () => void;
};

export function RoomList({
  favourites,
  channels,
  dms,
  activeRoomId,
  collapsed,
  activeSpaceId,
  subspaces,
  parentSpaceName,
  onBack,
  onSelectSpace,
  onToggleCollapsed,
  onSelectRoom,
  onToggleFavourite,
  onReorderFavourites,
  onCreateChannel,
  onCreateDm,
}: Props) {
  const [query, setQuery] = useState("");
  const [tip, setTip] = useState<{ left: number; text: string; top: number } | null>(null);
  const [favouriteOrderIds, setFavouriteOrderIds] = useState<string[]>([]);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [openSections, setOpenSections] = useState({
    favourites: true,
    channels: true,
    dms: true,
  });
  const createMenuRef = useRef<HTMLDivElement | null>(null);
  const total = favourites.length + channels.length + dms.length;
  const searchValue = query.trim().toLowerCase();
  const orderedFavourites = useMemo(
    () => reconcileRoomsByIds(favourites, favouriteOrderIds),
    [favourites, favouriteOrderIds],
  );

  const visibleFavourites = useMemo(
    () => filterRooms(orderedFavourites, searchValue),
    [orderedFavourites, searchValue],
  );
  const visibleChannels = useMemo(
    () => filterRooms(channels, searchValue),
    [channels, searchValue],
  );
  const visibleDms = useMemo(
    () => filterRooms(dms, searchValue),
    [dms, searchValue],
  );
  const visibleTotal = visibleFavourites.length + visibleChannels.length + visibleDms.length;
  const showRoomTip = (text: string, element: HTMLElement) => {
    if (!collapsed) return;
    const rect = element.getBoundingClientRect();
    setTip({
      text,
      top: rect.top + rect.height / 2,
      left: rect.right + 10,
    });
  };

  useEffect(() => {
    if (!createMenuOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!createMenuRef.current?.contains(event.target as Node)) {
        setCreateMenuOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setCreateMenuOpen(false);
      }
    };

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [createMenuOpen]);

  return (
    <aside className={`room-list${collapsed ? " is-collapsed" : ""}`}>
      <div className="room-list__head">
        <motion.div
          className="room-list__title"
          animate={{ opacity: collapsed ? 0 : 1, width: collapsed ? 0 : "auto" }}
          transition={transition.slow}
        >
          <strong>Surf Chat</strong>
          <span>{total} чатов</span>
        </motion.div>
        {!collapsed && (
          <div className="room-list__actions" ref={createMenuRef}>
            <button
              type="button"
              className={`room-list__create${createMenuOpen ? " is-open" : ""}`}
              title="Создать"
              onClick={() => setCreateMenuOpen((value) => !value)}
            >
              <span className="room-list__createIcon">
                <Plus size={16} />
              </span>
              <span>Создать</span>
              <motion.span
                className="room-list__createCaret"
                animate={{ rotate: createMenuOpen ? 45 : 0 }}
                transition={transition.fast}
              >
                <Plus size={12} />
              </motion.span>
            </button>
            <AnimatePresence>
              {createMenuOpen && (
                <motion.div
                  className="room-list__createMenu"
                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  transition={transition.fast}
                >
                  <button
                    type="button"
                    className="room-list__createItem"
                    onClick={() => {
                      setCreateMenuOpen(false);
                      onCreateChannel();
                    }}
                  >
                    <span className="room-list__createItemIcon">
                      <Hash size={15} />
                    </span>
                    <span className="room-list__createItemBody">
                      <strong>Новый канал</strong>
                      <small>{activeSpaceId ? "Внутри выбранного пространства" : "В общем списке чатов"}</small>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="room-list__createItem"
                    onClick={() => {
                      setCreateMenuOpen(false);
                      onCreateDm();
                    }}
                  >
                    <span className="room-list__createItemIcon">
                      <UserPlus size={15} />
                    </span>
                    <span className="room-list__createItemBody">
                      <strong>Личный чат</strong>
                      <small>Найти пользователя и начать переписку</small>
                    </span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
        <button
          type="button"
          className="room-list__collapse"
          title={collapsed ? "Развернуть" : "Свернуть"}
          onClick={onToggleCollapsed}
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={transition.slow}
            style={{ overflow: "hidden" }}
          >
            <label className="room-list__search">
              <Search size={16} />
              <input
                value={query}
                placeholder="Поиск"
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="room-list__sections">
        {!collapsed && parentSpaceName && (
          <button type="button" className="room-list__back" onClick={onBack}>
            <ChevronLeft size={16} />
            <span>{parentSpaceName}</span>
          </button>
        )}
        {!collapsed && subspaces.length > 0 && (
          <div className="room-list__subspaces">
            <div className="room-list__subspaces-title">Сабспейсы</div>
            {subspaces.map((space) => (
              <button
                key={space.id}
                type="button"
                className="room-subspace"
                onClick={() => onSelectSpace(space.id)}
              >
                <span className="room-subspace__avatar" style={{ background: space.color }}>
                  {space.label}
                  {space.avatarUrl && <AuthedImage url={space.avatarUrl} className="room-subspace__avatar-img" />}
                </span>
                <strong>{space.name}</strong>
                <ChevronRight size={15} />
              </button>
            ))}
          </div>
        )}
        <RoomSection
          title="Избранное"
          icon={<Star size={14} />}
          rooms={visibleFavourites}
          open={openSections.favourites}
          onToggleOpen={() => setOpenSections((state) => ({ ...state, favourites: !state.favourites }))}
          activeRoomId={activeRoomId}
          collapsed={collapsed}
          onSelectRoom={onSelectRoom}
          onToggleFavourite={onToggleFavourite}
          onShowTip={showRoomTip}
          onHideTip={() => setTip(null)}
          reorderable={!searchValue && activeSpaceId === null}
          onReorder={(rooms) => {
            setFavouriteOrderIds(rooms.map((room) => room.id));
            onReorderFavourites(rooms);
          }}
        />
        <RoomSection
          title="Каналы"
          icon={<Hash size={14} />}
          rooms={visibleChannels}
          open={openSections.channels}
          onToggleOpen={() => setOpenSections((state) => ({ ...state, channels: !state.channels }))}
          activeRoomId={activeRoomId}
          collapsed={collapsed}
          onSelectRoom={onSelectRoom}
          onToggleFavourite={onToggleFavourite}
          onShowTip={showRoomTip}
          onHideTip={() => setTip(null)}
        />
        <RoomSection
          title="Личные сообщения"
          icon={<MessageCircle size={14} />}
          rooms={visibleDms}
          open={openSections.dms}
          onToggleOpen={() => setOpenSections((state) => ({ ...state, dms: !state.dms }))}
          activeRoomId={activeRoomId}
          collapsed={collapsed}
          onSelectRoom={onSelectRoom}
          onToggleFavourite={onToggleFavourite}
          onShowTip={showRoomTip}
          onHideTip={() => setTip(null)}
        />
      </div>

      {total === 0 && (
        <div className="room-list__empty">
          Комнат пока нет или sync ещё не принёс список.
        </div>
      )}
      {total > 0 && visibleTotal === 0 && (
        <div className="room-list__empty">Ничего не найдено.</div>
      )}
      <AnimatePresence>
        {tip && (
          <motion.div
            className="room-list__tip"
            style={{ left: tip.left, top: tip.top }}
            initial={{ opacity: 0, x: -4, y: "-50%" }}
            animate={{ opacity: 1, x: 0, y: "-50%" }}
            exit={{ opacity: 0, x: -4, y: "-50%" }}
            transition={transition.fast}
          >
            {tip.text}
          </motion.div>
        )}
      </AnimatePresence>
    </aside>
  );
}

type SectionProps = {
  title: string;
  icon: React.ReactNode;
  rooms: MatrixRoomSummary[];
  open: boolean;
  onToggleOpen: () => void;
  activeRoomId: string | null;
  collapsed: boolean;
  onSelectRoom: (roomId: string) => void;
  onToggleFavourite: (roomId: string) => void;
  onShowTip: (text: string, element: HTMLElement) => void;
  onHideTip: () => void;
  reorderable?: boolean;
  onReorder?: (rooms: MatrixRoomSummary[]) => void;
};

function RoomSection({
  title,
  icon,
  rooms,
  open,
  onToggleOpen,
  activeRoomId,
  collapsed,
  onSelectRoom,
  onToggleFavourite,
  onShowTip,
  onHideTip,
  reorderable = false,
  onReorder,
}: SectionProps) {
  if (rooms.length === 0) return null;
  const renderRoom = (room: MatrixRoomSummary, index: number) => {
    const isActive = room.id === activeRoomId;

    return (
      <motion.div
        key={room.id}
        role="button"
        tabIndex={0}
        className={`room-row${isActive ? " is-active" : ""}${room.favourite ? " room-row--fav" : ""}`}
        onClick={() => onSelectRoom(room.id)}
        onMouseEnter={(event) => onShowTip(room.name, event.currentTarget)}
        onMouseLeave={onHideTip}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelectRoom(room.id);
          }
        }}
        initial="hidden"
        animate="visible"
        variants={fadeUp}
        transition={{ ...transition.base, delay: Math.min(index * 0.02, 0.3) }}
        whileTap={{ scale: 0.99 }}
      >
        {isActive && (
          <motion.span
            className="room-row__bg"
            layoutId="room-list-active-bg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={transition.fast}
          />
        )}
        <span className="room-row__avatar" style={{ background: room.color }}>
          {room.kind === "channel" ? <Hash size={17} /> : room.name.slice(0, 1).toUpperCase()}
          {room.avatarUrl && <AuthedImage url={room.avatarUrl} className="room-row__avatar-img" />}
          {collapsed && room.unread > 0 && <span className="room-row__badge room-row__badge--corner">{room.unread}</span>}
        </span>
        <span className="room-row__main">
          <span className="room-row__top">
            <strong>{room.name}</strong>
            <time>{room.time}</time>
          </span>
          <span className="room-row__preview">{room.preview || room.topic || "Нет сообщений"}</span>
        </span>
        <span className="room-row__meta">
          {!collapsed && room.unread > 0 && <span className="room-row__badge">{room.unread}</span>}
          <button
            type="button"
            className={`room-row__pin${room.favourite ? " is-on" : ""}`}
            title={room.favourite ? "Открепить" : "Закрепить"}
            onClick={(event) => {
              event.stopPropagation();
              onToggleFavourite(room.id);
            }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <Star size={15} fill={room.favourite ? "currentColor" : "none"} />
          </button>
        </span>
      </motion.div>
    );
  };

  return (
    <section className="room-section">
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.button
            type="button"
            className="room-section__title"
            onClick={onToggleOpen}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 28 }}
            exit={{ opacity: 0, height: 0 }}
            transition={transition.fast}
          >
            <motion.span
              className="room-section__chevron"
              animate={{ rotate: open ? 0 : -90 }}
              transition={transition.fast}
            >
              <ChevronDown size={14} />
            </motion.span>
            <span className="room-section__icon">{icon}</span>
            <span>{title}</span>
            <em>{rooms.length}</em>
          </motion.button>
        )}
      </AnimatePresence>
      <div className={`room-section__body${open ? " is-open" : ""}`}>
        <div className="room-section__body-inner">
          {reorderable && onReorder ? (
            <Reorder.Group
              as="div"
              axis="y"
              values={rooms}
              onReorder={onReorder}
              className="room-section__items"
            >
              {rooms.map((room, index) => (
                <Reorder.Item
                  as="div"
                  key={room.id}
                  value={room}
                  className="room-row__reorder-item"
                  whileDrag={{ scale: 1.02 }}
                  dragElastic={0.08}
                >
                  {renderRoom(room, index)}
                </Reorder.Item>
              ))}
            </Reorder.Group>
          ) : (
            <div className="room-section__items">
              {rooms.map(renderRoom)}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function filterRooms(rooms: MatrixRoomSummary[], query: string): MatrixRoomSummary[] {
  if (!query) return rooms;
  return rooms.filter((room) => {
    const preview = room.preview || room.topic || "";
    return `${room.name} ${preview}`.toLowerCase().includes(query);
  });
}

function reconcileRoomsByIds(
  next: MatrixRoomSummary[],
  previousIds: string[],
): MatrixRoomSummary[] {
  const nextById = new Map(next.map((room) => [room.id, room]));
  const kept = previousIds
    .map((id) => nextById.get(id))
    .filter((room): room is MatrixRoomSummary => Boolean(room));
  const keptIds = new Set(kept.map((room) => room.id));
  const added = next.filter((room) => !keptIds.has(room.id));
  return [...kept, ...added];
}
