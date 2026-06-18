import type { RemoteTrack, Room } from "livekit-client";

/**
 * Connects to the LiveKit SFU and publishes the local microphone.
 * Dynamic import keeps `livekit-client` out of the main bundle until a call starts.
 */
export async function connectLiveKitRoom(
  wsUrl: string,
  jwt: string,
  onDisconnect?: () => void,
): Promise<{ room: Room; unwatch: () => void }> {
  const { Room: LiveKitRoom, RoomEvent, Track } = await import("livekit-client");
  const room = new LiveKitRoom({
    adaptiveStream: true,
    dynacast: true,
  });

  const audioRoot = document.createElement("div");
  audioRoot.hidden = true;
  audioRoot.setAttribute("aria-hidden", "true");
  document.body.appendChild(audioRoot);

  const attachRemoteAudio = (track: RemoteTrack) => {
    if (track.kind !== Track.Kind.Audio) return;
    const el = track.attach();
    audioRoot.appendChild(el);
  };

  const detachRemoteAudio = (track: RemoteTrack) => {
    track.detach().forEach((el) => el.remove());
  };

  room.on(RoomEvent.TrackSubscribed, attachRemoteAudio);
  room.on(RoomEvent.TrackUnsubscribed, detachRemoteAudio);

  await room.connect(wsUrl, jwt);
  await room.localParticipant.setMicrophoneEnabled(true);
  // Phone click is a user gesture; unlocks playback on Safari and strict autoplay policies.
  try {
    await room.startAudio();
  } catch {
    // Playback may still need an extra tap on some browsers.
  }

  const unwatchParts: Array<() => void> = [
    () => {
      room.off(RoomEvent.TrackSubscribed, attachRemoteAudio);
      room.off(RoomEvent.TrackUnsubscribed, detachRemoteAudio);
      audioRoot.remove();
    },
  ];

  if (onDisconnect) {
    const handler = () => onDisconnect();
    room.on(RoomEvent.Disconnected, handler);
    unwatchParts.push(() => room.off(RoomEvent.Disconnected, handler));
  }

  return { room, unwatch: () => unwatchParts.forEach((fn) => fn()) };
}

export async function disconnectLiveKitRoom(room: Room | null): Promise<void> {
  if (!room || room.state === "disconnected") return;
  await room.disconnect();
}

export function setLiveKitMicrophoneMuted(room: Room | null, muted: boolean): void {
  void room?.localParticipant.setMicrophoneEnabled(!muted);
}
