import {
  ClientEvent,
  RoomEvent,
  RoomMemberEvent,
  RoomStateEvent,
  type MatrixClient,
} from "matrix-js-sdk";

const ROOM_GROUPS_REFRESH_DELAY_MS = 120;

export function subscribeRoomGroups(
  client: MatrixClient,
  onChange: () => void,
): () => void {
  let timer: number | undefined;
  // Initial sync / space joins can fire in bursts; rebuild room groups once.
  const bump = () => {
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(onChange, ROOM_GROUPS_REFRESH_DELAY_MS);
  };

  client.on(ClientEvent.Sync, bump);
  client.on(ClientEvent.Room, bump);
  client.on(ClientEvent.AccountData, bump);
  client.on(RoomEvent.Timeline, bump);
  client.on(RoomEvent.Name, bump);
  client.on(RoomEvent.Receipt, bump);
  client.on(RoomEvent.Tags, bump);
  client.on(RoomMemberEvent.Name, bump);
  // Space membership / m.space.child / join-rules are state events.
  client.on(RoomStateEvent.Events, bump);

  // UnreadNotifications is emitted on each Room, not re-emitted by the client.
  const rooms = client.getRooms();
  for (const room of rooms) {
    room.on(RoomEvent.UnreadNotifications, bump);
  }

  return () => {
    if (timer) window.clearTimeout(timer);
    client.off(ClientEvent.Sync, bump);
    client.off(ClientEvent.Room, bump);
    client.off(ClientEvent.AccountData, bump);
    client.off(RoomEvent.Timeline, bump);
    client.off(RoomEvent.Name, bump);
    client.off(RoomEvent.Receipt, bump);
    client.off(RoomEvent.Tags, bump);
    client.off(RoomMemberEvent.Name, bump);
    client.off(RoomStateEvent.Events, bump);
    for (const room of rooms) {
      room.off(RoomEvent.UnreadNotifications, bump);
    }
  };
}
