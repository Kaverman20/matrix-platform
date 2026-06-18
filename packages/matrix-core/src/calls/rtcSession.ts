import type { MatrixClient } from "matrix-js-sdk";
import type { MatrixRTCSession } from "matrix-js-sdk/lib/matrixrtc";
import { discoverRtcFoci } from "./discoverFoci";

/**
 * 1:1 / room call signalling on top of MatrixRTC (MSC4143).
 *
 * This module is React- and media-free on purpose: it only manages the Matrix
 * side — "who is in the call" via `MatrixRTCSession`. The actual audio/video
 * (LiveKit `Room.connect`) lives in the web app (`features/calls`).
 *
 * NOTE: the `matrixrtc` API in matrix-js-sdk is still marked unstable. These
 * signatures are verified against matrix-js-sdk@41.7.0:
 *   client.matrixRTC.getRoomSession(room) -> MatrixRTCSession
 *   session.joinRoomSession(fociPreferred: Transport[], multiSfuFocus?, joinConfig?): void
 *   session.leaveRoomSession(timeout?): Promise<boolean>
 *   session.isJoined(): boolean
 * Bumping the SDK requires re-checking these (see ADR 0002 + join/leave tests).
 */

export class CallUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CallUnavailableError";
  }
}

export type JoinCallOptions = {
  /** Emit an in-room ring notification for the callee (outgoing 1:1 call). */
  ring?: boolean;
};

/**
 * Joins (or creates) the RTC session for a room and announces our membership.
 * The returned session is what the UI subscribes to for membership changes and
 * what `livekit-client` uses to know which SFU to dial.
 *
 * Throws {@link CallUnavailableError} when the room is unknown or the homeserver
 * advertises no LiveKit focus (Stage 0 infra not deployed).
 */
export async function joinCall(
  client: MatrixClient,
  roomId: string,
  options?: JoinCallOptions,
): Promise<MatrixRTCSession> {
  const room = client.getRoom(roomId);
  if (!room) throw new CallUnavailableError(`Unknown room ${roomId}`);

  const foci = await discoverRtcFoci(client);
  if (foci.length === 0) {
    throw new CallUnavailableError("Homeserver advertises no LiveKit focus (rtc_foci)");
  }

  const session = client.matrixRTC.getRoomSession(room);
  const joinConfig = options?.ring
    ? { notificationType: "ring" as const, callIntent: "audio" as const }
    : undefined;
  // joinRoomSession is fire-and-forget (void): membership is published async and
  // observed via MatrixRTCSessionEvent. The first focus is our preferred SFU.
  session.joinRoomSession(foci, undefined, joinConfig);
  return session;
}

/** Leaves the RTC session, retracting our membership so peers see us hang up. */
export async function leaveCall(session: MatrixRTCSession): Promise<void> {
  if (session.isJoined()) {
    await session.leaveRoomSession();
  }
}
