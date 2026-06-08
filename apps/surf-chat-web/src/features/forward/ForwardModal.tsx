import { useMemo, useState } from "react";
import { Hash, Search, X } from "lucide-react";
import type { MatrixRoomSummary } from "@matrix-platform/matrix-core";
import "./forward-modal.css";

type Props = {
  rooms: MatrixRoomSummary[];
  title: string;
  onClose: () => void;
  onSelectRoom: (roomId: string) => void;
};

export function ForwardModal({ rooms, title, onClose, onSelectRoom }: Props) {
  const [query, setQuery] = useState("");
  const filteredRooms = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return rooms;
    return rooms.filter((room) => room.name.toLowerCase().includes(value));
  }, [query, rooms]);

  return (
    <div className="forward-overlay" onMouseDown={onClose}>
      <section
        className="forward-modal"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="forward-modal__head">
          <strong>{title}</strong>
          <button type="button" title="Закрыть" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <label className="forward-modal__search">
          <Search size={16} />
          <input
            autoFocus
            value={query}
            placeholder="Поиск чата"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="forward-modal__list">
          {filteredRooms.map((room) => (
            <button
              key={room.id}
              type="button"
              className="forward-room"
              onClick={() => onSelectRoom(room.id)}
            >
              <span className="forward-room__avatar" style={{ background: room.color }}>
                {room.kind === "channel" ? <Hash size={15} /> : room.name.slice(0, 1).toUpperCase()}
              </span>
              <span>
                <strong>{room.name}</strong>
                <small>{room.kind === "dm" ? "личный чат" : "канал"}</small>
              </span>
            </button>
          ))}
          {filteredRooms.length === 0 && (
            <div className="forward-modal__empty">Ничего не найдено</div>
          )}
        </div>
      </section>
    </div>
  );
}
