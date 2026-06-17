import type { MatrixClient, Room } from "matrix-js-sdk";
import { colorForId } from "./colors";
import { formatDisplayTime } from "../time/formatTime";
import type { MatrixRoomGroups, MatrixRoomSummary, MatrixSpaceSummary } from "./roomTypes";

type DirectAccountData = Record<string, string[]>;
type FavouriteTag = {
  order?: unknown;
};

export function buildRoomGroups(client: MatrixClient): MatrixRoomGroups {
  const dmIds = getDmRoomIds(client);
  const joined = client.getRooms().filter((room) => room.getMyMembership() === "join");
  const byActivity = (a: MatrixRoomSummary, b: MatrixRoomSummary) => b.timestamp - a.timestamp;

  const spaceRooms = joined.filter((room) => room.isSpaceRoom());
  const spaceIdSet = new Set(spaceRooms.map((room) => room.roomId));
  const spaces = spaceRooms
    .map((room) => mapSpace(room, client, spaceIdSet))
    .sort((a, b) => a.name.localeCompare(b.name));

  // A space is "nested" when it appears as a sub-space child of another space.
  const nestedSpaceIds = new Set<string>();
  for (const space of spaces) {
    for (const childSpaceId of space.childSpaceIds) nestedSpaceIds.add(childSpaceId);
  }
  for (const space of spaces) {
    space.nested = nestedSpaceIds.has(space.id);
  }

  const rooms = joined
    .filter((room) => !room.isSpaceRoom())
    .map((room) => mapRoom(room, client, dmIds));

  return {
    spaces,
    favourites: rooms
      .filter((room) => room.favourite)
      .sort((a, b) => a.favouriteOrder - b.favouriteOrder || byActivity(a, b)),
    channels: rooms
      .filter((room) => !room.favourite && room.kind === "channel")
      .sort(byActivity),
    dms: dedupeDirectRooms(rooms.filter((room) => !room.favourite && room.kind === "dm")).sort(byActivity),
  };
}

function mapRoom(
  room: Room,
  client: MatrixClient,
  dmIds: Set<string>,
): MatrixRoomSummary {
  const isDm = isDmLike(room, dmIds);
  const last = getLastMessage(room, client, isDm);
  const directUserId = isDm ? getDirectUserId(room, client) : undefined;
  const favTag = room.tags?.["m.favourite"] as FavouriteTag | undefined;
  const topic = room.currentState.getStateEvents("m.room.topic", "")?.getContent()
    ?.topic;

  return {
    id: room.roomId,
    name: room.name || room.roomId,
    preview: last.text,
    time: formatTime(last.timestamp),
    timestamp: last.timestamp,
    color: colorForId(room.roomId),
    avatarUrl: getRoomAvatarUrl(room, client, isDm),
    unread: room.getUnreadNotificationCount() ?? 0,
    kind: isDm ? "dm" : "channel",
    favourite: Boolean(favTag),
    favouriteOrder: typeof favTag?.order === "number" ? favTag.order : 0,
    memberCount: room.getInvitedAndJoinedMemberCount(),
    topic: typeof topic === "string" ? topic : "",
    directUserId,
  };
}

function dedupeDirectRooms(rooms: MatrixRoomSummary[]): MatrixRoomSummary[] {
  const byUser = new Map<string, MatrixRoomSummary>();
  const withoutPeer: MatrixRoomSummary[] = [];

  for (const room of rooms) {
    if (!room.directUserId) {
      withoutPeer.push(room);
      continue;
    }

    const existing = byUser.get(room.directUserId);
    if (!existing || room.timestamp > existing.timestamp) {
      byUser.set(room.directUserId, room);
    }
  }

  return [...byUser.values(), ...withoutPeer];
}

function mapSpace(room: Room, client: MatrixClient, spaceIdSet: Set<string>): MatrixSpaceSummary {
  const avatarMxc = room.currentState.getStateEvents("m.room.avatar", "")?.getContent()
    ?.url;
  const avatarUrl =
    typeof avatarMxc === "string"
      ? client.mxcUrlToHttp(avatarMxc, 96, 96, "crop", false, true, true) ?? undefined
      : undefined;

  const childIds = getSpaceChildIds(room);

  return {
    id: room.roomId,
    name: room.name || room.roomId,
    label: spaceLabel(room.name || "?"),
    color: colorForId(room.roomId),
    avatarUrl,
    childIds,
    childSpaceIds: childIds.filter((id) => spaceIdSet.has(id)),
    nested: false,
  };
}

function getDmRoomIds(client: MatrixClient): Set<string> {
  const ev = client.getAccountData("m.direct" as never);
  const content = (ev?.getContent() ?? {}) as DirectAccountData;
  const ids = new Set<string>();

  Object.values(content).forEach((roomIds) => {
    if (Array.isArray(roomIds)) {
      roomIds.forEach((roomId) => ids.add(roomId));
    }
  });

  return ids;
}

function isDmLike(room: Room, dmIds: Set<string>): boolean {
  if (dmIds.has(room.roomId)) return true;

  const memberCount = room.getInvitedAndJoinedMemberCount();
  if (memberCount !== 2) return false;

  const nameEvent = room.currentState.getStateEvents("m.room.name", "");
  const hasName = Boolean(nameEvent?.getContent().name);
  const hasAlias = Boolean(room.getCanonicalAlias());

  return !hasName && !hasAlias;
}

function getDirectUserId(room: Room, client: MatrixClient): string | undefined {
  const me = client.getUserId();
  const members = room.getJoinedMembers();
  return members.find((member) => member.userId !== me)?.userId;
}

function getLastMessage(
  room: Room,
  client: MatrixClient,
  isDm: boolean,
): { text: string; timestamp: number } {
  const events = room.getLiveTimeline().getEvents();
  const me = client.getUserId();

  for (let i = events.length - 1; i >= 0; i -= 1) {
    const ev = events[i];
    if (ev.getType() !== "m.room.message") continue;
    if (ev.isRedacted()) continue;

    const content = ev.getContent();
    const body = typeof content.body === "string" ? content.body : "";
    const sender = ev.getSender() ?? "";
    const senderName = sender === me ? "Вы" : room.getMember(sender)?.name?.split(" ")[0] ?? "";

    return {
      text: isDm || !senderName ? body : `${senderName}: ${body}`,
      timestamp: ev.getTs(),
    };
  }

  return { text: "", timestamp: room.getLastActiveTimestamp() ?? 0 };
}

function getRoomAvatarUrl(
  room: Room,
  client: MatrixClient,
  isDm: boolean,
): string | undefined {
  let mxc = room.currentState.getStateEvents("m.room.avatar", "")?.getContent()
    ?.url;

  if (typeof mxc !== "string" && isDm) {
    const me = client.getUserId();
    const otherMember = room.getJoinedMembers().find((member) => member.userId !== me);
    mxc = otherMember?.getMxcAvatarUrl?.();
  }

  if (typeof mxc !== "string") return undefined;
  return client.mxcUrlToHttp(mxc, 96, 96, "crop", false, true, true) ?? undefined;
}

function getSpaceChildIds(space: Room): string[] {
  const events = space.currentState.getStateEvents("m.space.child");
  const childIds: string[] = [];

  for (const ev of events) {
    const stateKey = ev.getStateKey();
    const content = ev.getContent() as { via?: string[] };
    if (stateKey && Array.isArray(content.via)) childIds.push(stateKey);
  }

  return childIds;
}

function spaceLabel(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase();
  return name.trim().slice(0, 2).toUpperCase() || "S";
}

function formatTime(timestamp: number): string {
  return formatDisplayTime(timestamp);
}
