import {
  ClientEvent,
  RoomEvent,
  RoomMemberEvent,
  RoomStateEvent,
  type MatrixClient,
  type Room,
} from "matrix-js-sdk";

const ROOM_GROUPS_REFRESH_DELAY_MS = 120;

export function subscribeRoomGroups(
  client: MatrixClient,
  onChange: () => void,
): () => void {
  let timer: number | undefined;
  const unreadRooms = new Set<Room>();

  // Initial sync / space joins can fire in bursts; rebuild room groups once.
  const bump = () => {
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(onChange, ROOM_GROUPS_REFRESH_DELAY_MS);
  };

  const attachUnreadListener = (room: Room) => {
    if (unreadRooms.has(room)) return;
    unreadRooms.add(room);
    room.on(RoomEvent.UnreadNotifications, bump);
  };

  const onRoom = (room: Room) => {
    attachUnreadListener(room);
    bump();
  };

  client.on(ClientEvent.Sync, bump);
  client.on(ClientEvent.Room, onRoom);
  client.on(ClientEvent.AccountData, bump);
  client.on(RoomEvent.Timeline, bump);
  client.on(RoomEvent.Name, bump);
  client.on(RoomEvent.Receipt, bump);
  client.on(RoomEvent.Tags, bump);
  client.on(RoomMemberEvent.Name, bump);
  // Space membership / m.space.child / join-rules are state events.
  client.on(RoomStateEvent.Events, bump);

  // UnreadNotifications is emitted on each Room, not re-emitted by the client.
  for (const room of client.getRooms()) {
    attachUnreadListener(room);
  }

  return () => {
    if (timer) window.clearTimeout(timer);
    client.off(ClientEvent.Sync, bump);
    client.off(ClientEvent.Room, onRoom);
    client.off(ClientEvent.AccountData, bump);
    client.off(RoomEvent.Timeline, bump);
    client.off(RoomEvent.Name, bump);
    client.off(RoomEvent.Receipt, bump);
    client.off(RoomEvent.Tags, bump);
    client.off(RoomMemberEvent.Name, bump);
    client.off(RoomStateEvent.Events, bump);
    for (const room of unreadRooms) {
      room.off(RoomEvent.UnreadNotifications, bump);
    }
  };
}
