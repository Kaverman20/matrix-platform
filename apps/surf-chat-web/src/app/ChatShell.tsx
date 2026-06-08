import { LogOut } from "lucide-react";
import { useMemo, useState } from "react";
import { useMatrix } from "./providers/MatrixContext";
import { Composer } from "../features/composer/Composer";
import { RoomList } from "../features/room-list/RoomList";
import { useRoomGroups } from "../features/room-list/useRoomGroups";
import { Timeline } from "../features/timeline/Timeline";
import { useTimelineMessages } from "../features/timeline/useTimelineMessages";
import "./chat-shell.css";

export function ChatShell() {
  const { client, logout, userId } = useMatrix();
  const roomGroups = useRoomGroups(client);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);

  const activeRoom = useMemo(() => {
    const allRooms = [
      ...roomGroups.favourites,
      ...roomGroups.channels,
      ...roomGroups.dms,
    ];
    return allRooms.find((room) => room.id === activeRoomId) ?? null;
  }, [activeRoomId, roomGroups.channels, roomGroups.dms, roomGroups.favourites]);
  const messages = useTimelineMessages(client, activeRoomId);

  return (
    <div className="chat-shell">
      <nav className="space-rail">
        <button className="space-rail__home is-active" title="Все чаты">
          S
        </button>
        <div className="space-rail__spaces">
          {roomGroups.spaces.map((space) => (
            <button
              key={space.id}
              className="space-rail__item"
              style={{ background: space.color }}
              title={space.name}
            >
              {space.label}
            </button>
          ))}
        </div>
        <button
          className="space-rail__logout"
          title="Выйти"
          onClick={() => void logout()}
        >
          <LogOut size={18} />
        </button>
      </nav>

      <RoomList
        favourites={roomGroups.favourites}
        channels={roomGroups.channels}
        dms={roomGroups.dms}
        activeRoomId={activeRoomId}
        onSelectRoom={setActiveRoomId}
      />

      <main className="chat-main">
        {activeRoom ? (
          <>
            <header className="chat-main__header">
              <div>
                <h1>{activeRoom.name}</h1>
                <span>
                  {activeRoom.memberCount} участников · {activeRoom.kind === "dm" ? "личный чат" : "канал"}
                </span>
              </div>
            </header>
            <Timeline messages={messages} />
            <Composer roomId={activeRoom.id} />
          </>
        ) : (
          <section className="chat-main__placeholder">
            <h1>Surf Chat</h1>
            <p>{userId ? `Вы вошли как ${userId}` : "Выберите чат слева"}</p>
          </section>
        )}
      </main>
    </div>
  );
}
