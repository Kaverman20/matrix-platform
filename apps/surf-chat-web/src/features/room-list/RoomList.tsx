import { Hash, MessageCircle, Star } from "lucide-react";
import type { MatrixRoomSummary } from "@matrix-platform/matrix-core";
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
  const total = favourites.length + channels.length + dms.length;

  return (
    <aside className="room-list">
      <div className="room-list__head">
        <div>
          <strong>Surf Chat</strong>
          <span>{total} чатов</span>
        </div>
      </div>

      <div className="room-list__sections">
        <RoomSection
          title="Избранное"
          icon={<Star size={14} />}
          rooms={favourites}
          activeRoomId={activeRoomId}
          onSelectRoom={onSelectRoom}
        />
        <RoomSection
          title="Каналы"
          icon={<Hash size={14} />}
          rooms={channels}
          activeRoomId={activeRoomId}
          onSelectRoom={onSelectRoom}
        />
        <RoomSection
          title="Личные"
          icon={<MessageCircle size={14} />}
          rooms={dms}
          activeRoomId={activeRoomId}
          onSelectRoom={onSelectRoom}
        />
      </div>

      {total === 0 && (
        <div className="room-list__empty">
          Комнат пока нет или sync ещё не принёс список.
        </div>
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
        {rooms.map((room) => (
          <button
            key={room.id}
            className={`room-row${room.id === activeRoomId ? " is-active" : ""}`}
            onClick={() => onSelectRoom(room.id)}
          >
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
          </button>
        ))}
      </div>
    </section>
  );
}

