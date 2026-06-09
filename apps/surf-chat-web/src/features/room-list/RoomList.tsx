import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Hash, MessageCircle, Search, Star } from "lucide-react";
import type { MatrixRoomSummary } from "@matrix-platform/matrix-core";
import { fadeUp, transition } from "@matrix-platform/ui";
import "./room-list.css";

type Props = {
  favourites: MatrixRoomSummary[];
  channels: MatrixRoomSummary[];
  dms: MatrixRoomSummary[];
  activeRoomId: string | null;
  onSelectRoom: (roomId: string) => void;
};

export function RoomList({
  favourites,
  channels,
  dms,
  activeRoomId,
  onSelectRoom,
}: Props) {
  const [query, setQuery] = useState("");
  const total = favourites.length + channels.length + dms.length;
  const searchValue = query.trim().toLowerCase();
  const visibleFavourites = useMemo(
    () => filterRooms(favourites, searchValue),
    [favourites, searchValue],
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
    <aside className="room-list">
      <div className="room-list__head">
        <div>
          <strong>Surf Chat</strong>
          <span>{total} чатов</span>
        </div>
      </div>
      <label className="room-list__search">
        <Search size={16} />
        <input
          value={query}
          placeholder="Поиск"
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>

      <div className="room-list__sections">
        <RoomSection
          title="Избранное"
          icon={<Star size={14} />}
          rooms={visibleFavourites}
          activeRoomId={activeRoomId}
          onSelectRoom={onSelectRoom}
        />
        <RoomSection
          title="Каналы"
          icon={<Hash size={14} />}
          rooms={visibleChannels}
          activeRoomId={activeRoomId}
          onSelectRoom={onSelectRoom}
        />
        <RoomSection
          title="Личные"
          icon={<MessageCircle size={14} />}
          rooms={visibleDms}
          activeRoomId={activeRoomId}
          onSelectRoom={onSelectRoom}
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
    </aside>
  );
}

type SectionProps = {
  title: string;
  icon: React.ReactNode;
  rooms: MatrixRoomSummary[];
  activeRoomId: string | null;
  onSelectRoom: (roomId: string) => void;
};

function RoomSection({
  title,
  icon,
  rooms,
  activeRoomId,
  onSelectRoom,
}: SectionProps) {
  if (rooms.length === 0) return null;

  return (
    <section className="room-section">
      <div className="room-section__title">
        {icon}
        <span>{title}</span>
        <em>{rooms.length}</em>
      </div>
      <div className="room-section__items">
        {rooms.map((room, index) => {
          const isActive = room.id === activeRoomId;

          return (
          <motion.div
            key={room.id}
            role="button"
            tabIndex={0}
            className={`room-row${isActive ? " is-active" : ""}`}
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
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={transition.fast}
              />
            )}
            <span className="room-row__avatar" style={{ background: room.color }}>
              {room.kind === "channel" ? <Hash size={17} /> : room.name.slice(0, 1).toUpperCase()}
            </span>
            <span className="room-row__main">
              <span className="room-row__top">
                <strong>{room.name}</strong>
                <time>{room.time}</time>
              </span>
              <span className="room-row__preview">{room.preview || room.topic || "Нет сообщений"}</span>
            </span>
            {room.unread > 0 && <span className="room-row__badge">{room.unread}</span>}
          </motion.div>
          );
        })}
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
