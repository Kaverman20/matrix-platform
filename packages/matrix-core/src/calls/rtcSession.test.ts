import { describe, expect, it, vi } from "vitest";
import type { MatrixClient } from "matrix-js-sdk";
import type { MatrixRTCSession } from "matrix-js-sdk/lib/matrixrtc";
import { CallUnavailableError, joinCall, leaveCall } from "./rtcSession";

const LIVEKIT_FOCUS = { type: "livekit", livekit_service_url: "https://rtc.example" };

function fakeSession(joined: boolean) {
  return {
    isJoined: () => joined,
    joinRoomSession: vi.fn(),
    leaveRoomSession: vi.fn().mockResolvedValue(true),
  } as unknown as MatrixRTCSession & {
    joinRoomSession: ReturnType<typeof vi.fn>;
    leaveRoomSession: ReturnType<typeof vi.fn>;
  };
}

function fakeClient({
  hasRoom = true,
  foci = [LIVEKIT_FOCUS] as unknown[],
  session = fakeSession(false),
}: {
  hasRoom?: boolean;
  foci?: unknown[];
  session?: ReturnType<typeof fakeSession>;
} = {}): { client: MatrixClient; session: ReturnType<typeof fakeSession>; getRoomSession: ReturnType<typeof vi.fn> } {
  const room = {};
  const getRoomSession = vi.fn().mockReturnValue(session);
  const client = {
    getRoom: () => (hasRoom ? room : null),
    getClientWellKnown: () => ({ "org.matrix.msc4143.rtc_foci": foci }),
    matrixRTC: { getRoomSession },
  } as unknown as MatrixClient;
  return { client, session, getRoomSession };
}

describe("joinCall", () => {
  it("throws when the room is unknown", async () => {
    const { client } = fakeClient({ hasRoom: false });
    await expect(joinCall(client, "!nope:server")).rejects.toBeInstanceOf(CallUnavailableError);
  });

  it("throws when the homeserver advertises no LiveKit focus", async () => {
    const { client } = fakeClient({ foci: [] });
    await expect(joinCall(client, "!room:server")).rejects.toBeInstanceOf(CallUnavailableError);
  });

  it("ignores malformed foci entries", async () => {
    const { client } = fakeClient({ foci: [{ type: "not-livekit" }, { nope: true }] });
    await expect(joinCall(client, "!room:server")).rejects.toBeInstanceOf(CallUnavailableError);
  });

  it("joins with audio intent by default (no ring)", async () => {
    const { client, session } = fakeClient();
    const result = await joinCall(client, "!room:server");
    expect(result).toBe(session);
    expect(session.joinRoomSession).toHaveBeenCalledWith([LIVEKIT_FOCUS], undefined, {
      callIntent: "audio",
    });
  });

  it("passes ring notification config when requested", async () => {
    const { client, session } = fakeClient();
    await joinCall(client, "!room:server", { ring: true });
    expect(session.joinRoomSession).toHaveBeenCalledWith([LIVEKIT_FOCUS], undefined, {
      notificationType: "ring",
      callIntent: "audio",
    });
  });

  it("announces video intent for a video call", async () => {
    const { client, session } = fakeClient();
    await joinCall(client, "!room:server", { ring: true, intent: "video" });
    expect(session.joinRoomSession).toHaveBeenCalledWith([LIVEKIT_FOCUS], undefined, {
      notificationType: "ring",
      callIntent: "video",
    });
  });
});

describe("leaveCall", () => {
  it("leaves when joined", async () => {
    const session = fakeSession(true);
    await leaveCall(session);
    expect(session.leaveRoomSession).toHaveBeenCalledOnce();
  });

  it("is a no-op when not joined", async () => {
    const session = fakeSession(false);
    await leaveCall(session);
    expect(session.leaveRoomSession).not.toHaveBeenCalled();
  });
});
