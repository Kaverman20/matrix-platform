import { useEffect, useMemo, useState } from "react";
import { RoomMemberEvent, type MatrixClient } from "matrix-js-sdk";
import { getTypingNames } from "@matrix-platform/matrix-core";

/** Live list of other members currently typing in the active room. */
export function useTyping(
  client: MatrixClient | null,
  roomId: string | null,
): string[] {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!client || !roomId) return;
    const bump = () => setVersion((value) => value + 1);
    client.on(RoomMemberEvent.Typing, bump);
    return () => {
      client.off(RoomMemberEvent.Typing, bump);
    };
  }, [client, roomId]);

  return useMemo(() => {
    void version;
    if (!client || !roomId) return [];
    return getTypingNames(client, roomId);
  }, [client, roomId, version]);
}

/** Human-readable label like "Алиса печатает…" / "печатают: …". */
export function formatTypingLabel(names: string[]): string | null {
  if (names.length === 0) return null;
  if (names.length === 1) return `${names[0]} печатает…`;
  if (names.length === 2) return `${names[0]} и ${names[1]} печатают…`;
  return `${names[0]} и ещё ${names.length - 1} печатают…`;
}
