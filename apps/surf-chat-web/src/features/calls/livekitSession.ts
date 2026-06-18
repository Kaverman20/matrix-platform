import type { Room } from "livekit-client";

/**
 * Connects to the LiveKit SFU and publishes the local microphone.
 * Dynamic import keeps `livekit-client` out of the main bundle until a call starts.
 */
export async function connectLiveKitRoom(wsUrl: string, jwt: string): Promise<Room> {
  const { Room: LiveKitRoom } = await import("livekit-client");
  const room = new LiveKitRoom({
    adaptiveStream: true,
    dynacast: true,
  });
  await room.connect(wsUrl, jwt);
  await room.localParticipant.setMicrophoneEnabled(true);
  return room;
}

export async function disconnectLiveKitRoom(room: Room | null): Promise<void> {
  if (!room || room.state === "disconnected") return;
  await room.disconnect();
}

export function setLiveKitMicrophoneMuted(room: Room | null, muted: boolean): void {
  void room?.localParticipant.setMicrophoneEnabled(!muted);
}
