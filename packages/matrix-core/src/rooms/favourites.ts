import type { MatrixClient } from "matrix-js-sdk";

const FAVOURITE_TAG = "m.favourite";
/** Default order for a freshly favourited room (mid-range until reordered). */
const DEFAULT_FAVOURITE_ORDER = 0.5;

/** Adds or removes the m.favourite tag on a room. */
export async function setRoomFavourite(
  client: MatrixClient,
  roomId: string,
  isFavourite: boolean,
): Promise<void> {
  if (isFavourite) {
    await client.setRoomTag(roomId, FAVOURITE_TAG, { order: DEFAULT_FAVOURITE_ORDER });
  } else {
    await client.deleteRoomTag(roomId, FAVOURITE_TAG);
  }
}

/**
 * Persists a new ordering of favourite rooms. The order tag is spread evenly
 * across [0, 1] in the given sequence (a single favourite gets order 0).
 */
export async function reorderFavourites(
  client: MatrixClient,
  orderedRoomIds: string[],
): Promise<void> {
  const last = orderedRoomIds.length - 1;
  await Promise.all(
    orderedRoomIds.map((roomId, index) => {
      const order = last > 0 ? index / last : 0;
      return client.setRoomTag(roomId, FAVOURITE_TAG, { order });
    }),
  );
}
