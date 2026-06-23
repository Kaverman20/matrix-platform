import type {
  LocalVideoTrack,
  RemoteTrack,
  RemoteTrackPublication,
  RemoteVideoTrack,
  Room,
} from "livekit-client";

export type RemoteVideoSource = "camera" | "screen";

export type LiveKitHandlers = {
  /** Fired when the LiveKit room disconnects (network drop / server close). */
  onDisconnect?: () => void;
  /** Whether any remote participant is in the room — drives ringing → in-call. */
  onRemotePresence?: (present: boolean) => void;
  /** A remote camera/screen video track appeared (track) or went away (null). */
  onRemoteVideo?: (source: RemoteVideoSource, track: RemoteVideoTrack | null) => void;
  onReconnecting?: () => void;
  onReconnected?: () => void;
};

export type ConnectOptions = {
  /** Publish the camera on join when "video". */
  intent?: "audio" | "video";
  handlers?: LiveKitHandlers;
};

/**
 * Connects to the LiveKit SFU, publishes the microphone (and camera for a video
 * call), and bridges remote media to the UI via callbacks. Dynamic import keeps
 * `livekit-client` out of the main bundle until a call starts.
 *
 * Returns the local camera track (for the self-PiP) when the call started with
 * video, plus an `unwatch` that detaches every listener and the audio sink.
 */
export async function connectLiveKitRoom(
  wsUrl: string,
  jwt: string,
  options?: ConnectOptions,
): Promise<{ room: Room; unwatch: () => void; localCameraTrack: LocalVideoTrack | null }> {
  const handlers = options?.handlers;
  const { Room: LiveKitRoom, RoomEvent, Track } = await import("livekit-client");
  const room = new LiveKitRoom({ adaptiveStream: true, dynacast: true });

  const audioRoot = document.createElement("div");
  audioRoot.hidden = true;
  audioRoot.setAttribute("aria-hidden", "true");
  document.body.appendChild(audioRoot);

  const emitPresence = () => handlers?.onRemotePresence?.(room.remoteParticipants.size > 0);
  const sourceOf = (pub: RemoteTrackPublication): RemoteVideoSource =>
    pub.source === Track.Source.ScreenShare ? "screen" : "camera";

  const onTrackSubscribed = (track: RemoteTrack, pub: RemoteTrackPublication) => {
    if (track.kind === Track.Kind.Audio) {
      audioRoot.appendChild(track.attach());
    } else if (track.kind === Track.Kind.Video) {
      handlers?.onRemoteVideo?.(sourceOf(pub), track as RemoteVideoTrack);
    }
    // Any subscribed track means the peer is really here — back up ParticipantConnected.
    emitPresence();
  };

  const onTrackUnsubscribed = (track: RemoteTrack, pub: RemoteTrackPublication) => {
    if (track.kind === Track.Kind.Audio) {
      track.detach().forEach((el) => el.remove());
    } else if (track.kind === Track.Kind.Video) {
      handlers?.onRemoteVideo?.(sourceOf(pub), null);
    }
  };

  room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);
  room.on(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
  room.on(RoomEvent.ParticipantConnected, emitPresence);
  room.on(RoomEvent.ParticipantDisconnected, emitPresence);
  if (handlers?.onReconnecting) room.on(RoomEvent.Reconnecting, handlers.onReconnecting);
  if (handlers?.onReconnected) room.on(RoomEvent.Reconnected, handlers.onReconnected);

  await room.connect(wsUrl, jwt);
  await room.localParticipant.setMicrophoneEnabled(true);

  let localCameraTrack: LocalVideoTrack | null = null;
  if (options?.intent === "video") {
    await room.localParticipant.setCameraEnabled(true);
    localCameraTrack =
      (room.localParticipant.getTrackPublication(Track.Source.Camera)?.videoTrack as
        | LocalVideoTrack
        | undefined) ?? null;
  }

  // Phone click is a user gesture; unlocks playback on Safari / strict autoplay.
  try {
    await room.startAudio();
  } catch {
    // Playback may still need an extra tap on some browsers.
  }

  emitPresence();

  const unwatch = () => {
    room.off(RoomEvent.TrackSubscribed, onTrackSubscribed);
    room.off(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
    room.off(RoomEvent.ParticipantConnected, emitPresence);
    room.off(RoomEvent.ParticipantDisconnected, emitPresence);
    if (handlers?.onReconnecting) room.off(RoomEvent.Reconnecting, handlers.onReconnecting);
    if (handlers?.onReconnected) room.off(RoomEvent.Reconnected, handlers.onReconnected);
    if (handlers?.onDisconnect) room.off(RoomEvent.Disconnected, handlers.onDisconnect);
    audioRoot.remove();
  };

  if (handlers?.onDisconnect) room.on(RoomEvent.Disconnected, handlers.onDisconnect);

  return { room, unwatch, localCameraTrack };
}

export async function disconnectLiveKitRoom(room: Room | null): Promise<void> {
  if (!room || room.state === "disconnected") return;
  await room.disconnect();
}

export function setLiveKitMicrophoneMuted(room: Room | null, muted: boolean): void {
  void room?.localParticipant.setMicrophoneEnabled(!muted);
}

/** Toggles the local camera. Returns the new local camera track (for the PiP) or
 * null when turning it off. `livekit-client` is already loaded mid-call, so the
 * dynamic import here is cache-cheap and keeps it out of the main bundle. */
export async function setLiveKitCameraEnabled(
  room: Room | null,
  enabled: boolean,
): Promise<LocalVideoTrack | null> {
  if (!room) return null;
  const { Track } = await import("livekit-client");
  await room.localParticipant.setCameraEnabled(enabled);
  if (!enabled) return null;
  return (
    (room.localParticipant.getTrackPublication(Track.Source.Camera)?.videoTrack as
      | LocalVideoTrack
      | undefined) ?? null
  );
}

/** Toggles screen sharing. When starting, wires the browser's native "Stop
 * sharing" (the track's `ended` event) to `onEnded` so the UI flips back. */
export async function setLiveKitScreenShareEnabled(
  room: Room | null,
  enabled: boolean,
  onEnded?: () => void,
): Promise<LocalVideoTrack | null> {
  if (!room) return null;
  const { Track } = await import("livekit-client");
  if (!enabled) {
    await room.localParticipant.setScreenShareEnabled(false);
    return null;
  }
  await room.localParticipant.setScreenShareEnabled(true, { audio: false });
  const publication = room.localParticipant.getTrackPublication(Track.Source.ScreenShare);
  const mediaTrack = publication?.track?.mediaStreamTrack;
  if (mediaTrack && onEnded) {
    mediaTrack.addEventListener("ended", () => onEnded(), { once: true });
  }
  // Возвращаем локальный screen-трек, чтобы показать СВОЙ экран на main stage.
  return (publication?.videoTrack as LocalVideoTrack | undefined) ?? null;
}
