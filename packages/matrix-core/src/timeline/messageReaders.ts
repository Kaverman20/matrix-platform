import type { MatrixClient } from "matrix-js-sdk";

export type MessageReader = {
  userId: string;
  name: string;
  avatarUrl?: string;
};

/** Users who have read up to this message (excluding the sender). */
export function getMessageReaders(
  client: MatrixClient,
  roomId: string,
  eventId: string,
): MessageReader[] {
  const room = client.getRoom(roomId);
  const event = room?.findEventById(eventId);
  if (!room || !event) return [];

  const sender = event.getSender();
  const userIds = room.getUsersReadUpTo(event).filter((userId) => userId !== sender);

  return userIds.map((userId) => {
    const member = room.getMember(userId);
    const avatarMxc = member?.getMxcAvatarUrl();
    const avatarUrl = avatarMxc ? client.mxcUrlToHttp(avatarMxc, 48, 48, "crop", false, true, true) ?? undefined : undefined;
    return {
      userId,
      name: member?.name || userId,
      avatarUrl,
    };
  });
}
