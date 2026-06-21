import { Hash } from "lucide-react";
import type { MatrixRoomSummary } from "@matrix-platform/matrix-core";

export function RoomIntro({ room }: { room: MatrixRoomSummary }) {
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
