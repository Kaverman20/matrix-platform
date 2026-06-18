import type { RemoteTrack, Room } from "livekit-client";

export type LiveKitHandlers = {
  /** Fired when the LiveKit room disconnects (network drop / server close). */
  onDisconnect?: () => void;
  /** Fired with whether any remote participant is currently in the room.
   * Drives the "ringing → in-call" transition (peer actually joined). */
  onRemotePresence?: (present: boolean) => void;
};

/**
 * Connects to the LiveKit SFU and publishes the local microphone.
 * Dynamic import keeps `livekit-client` out of the main bundle until a call starts.
 */
export async function connectLiveKitRoom(
  wsUrl: string,
  jwt: string,
  handlers?: LiveKitHandlers,
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

  const emitPresence = () => handlers?.onRemotePresence?.(room.remoteParticipants.size > 0);
  room.on(RoomEvent.ParticipantConnected, emitPresence);
  room.on(RoomEvent.ParticipantDisconnected, emitPresence);

  await room.connect(wsUrl, jwt);
  await room.localParticipant.setMicrophoneEnabled(true);
  // Phone click is a user gesture; unlocks playback on Safari and strict autoplay policies.
  try {
    await room.startAudio();
  } catch {
    // Playback may still need an extra tap on some browsers.
  }

  // Report the initial state: when answering an existing call the caller is
  // already here (→ in-call); when placing one we're alone (→ ringing).
  emitPresence();

  const unwatchParts: Array<() => void> = [
    () => {
      room.off(RoomEvent.TrackSubscribed, attachRemoteAudio);
      room.off(RoomEvent.TrackUnsubscribed, detachRemoteAudio);
      room.off(RoomEvent.ParticipantConnected, emitPresence);
      room.off(RoomEvent.ParticipantDisconnected, emitPresence);
      audioRoot.remove();
    },
  ];

  if (handlers?.onDisconnect) {
    const handler = () => handlers.onDisconnect?.();
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
