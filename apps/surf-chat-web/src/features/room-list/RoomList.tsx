import { useMemo, useState } from "react";
import { AnimatePresence, motion, Reorder } from "framer-motion";
import { ChevronDown, Hash, MessageCircle, PanelLeftClose, PanelLeftOpen, Search, Star } from "lucide-react";
import type { MatrixRoomSummary } from "@matrix-platform/matrix-core";
import { fadeUp, transition } from "@matrix-platform/ui";
import "./room-list.css";

type Props = {
  favourites: MatrixRoomSummary[];
  channels: MatrixRoomSummary[];
  dms: MatrixRoomSummary[];
  activeRoomId: string | null;
  onSelectRoom: (roomId: string) => void;
  onToggleFavourite: (roomId: string) => void;
  onReorderFavourites: (rooms: MatrixRoomSummary[]) => void;
};

export function RoomList({
  favourites,
  channels,
  dms,
  activeRoomId,
  onSelectRoom,
  onToggleFavourite,
  onReorderFavourites,
}: Props) {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [favouriteOrderIds, setFavouriteOrderIds] = useState<string[]>([]);
  const [openSections, setOpenSections] = useState({
    favourites: true,
    channels: true,
    dms: true,
  });
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

  return (
    <motion.aside
      className={`room-list${collapsed ? " is-collapsed" : ""}`}
      animate={{
        width: collapsed ? 72 : "var(--roomlist-width)",
        minWidth: collapsed ? 72 : "var(--roomlist-width)",
      }}
      transition={transition.slow}
    >
      <div className="room-list__head">
        <motion.div
          className="room-list__title"
          animate={{ opacity: collapsed ? 0 : 1, width: collapsed ? 0 : "auto" }}
          transition={transition.slow}
        >
          <strong>Surf Chat</strong>
          <span>{total} чатов</span>
        </motion.div>
        <button
          type="button"
          className="room-list__collapse"
          title={collapsed ? "Развернуть" : "Свернуть"}
          onClick={() => setCollapsed((value) => !value)}
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
          reorderable={!searchValue}
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
        />
        <RoomSection
          title="Личные"
          icon={<MessageCircle size={14} />}
          rooms={visibleDms}
          open={openSections.dms}
          onToggleOpen={() => setOpenSections((state) => ({ ...state, dms: !state.dms }))}
          activeRoomId={activeRoomId}
          collapsed={collapsed}
          onSelectRoom={onSelectRoom}
          onToggleFavourite={onToggleFavourite}
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
    </motion.aside>
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
        data-tooltip={collapsed ? room.name : undefined}
        onClick={() => onSelectRoom(room.id)}
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
          {room.avatarUrl ? (
            <img className="room-row__avatar-img" src={room.avatarUrl} alt="" />
          ) : room.kind === "channel" ? (
            <Hash size={17} />
          ) : (
            room.name.slice(0, 1).toUpperCase()
          )}
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
          {!collapsed && room.unread > 0 && <span className="room-row__badge">{room.unread}</span>}
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
