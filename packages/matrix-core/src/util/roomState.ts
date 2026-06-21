import { EventTimeline, type Room } from "matrix-js-sdk";

/**
 * Read the content of a room state event, falling back from the synced current
 * state to the live timeline's forward state. Returns undefined when the room
 * is missing or the state event isn't present.
 */
export function getRoomStateContent<T>(
  room: Room | null | undefined,
  eventType: string,
): T | undefined {
  if (!room) return undefined;
  return (
    room.currentState.getStateEvents(eventType, "")?.getContent()
    ?? room
      .getLiveTimeline()
      .getState(EventTimeline.FORWARDS)
      ?.getStateEvents(eventType, "")
      ?.getContent()
  ) as T | undefined;
}
