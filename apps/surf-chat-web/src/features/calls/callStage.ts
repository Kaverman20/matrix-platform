import type { LocalVideoTrack, RemoteVideoTrack } from "livekit-client";
import type { CallMedia } from "./useRoomCall";

export type StageVideoTrack = LocalVideoTrack | RemoteVideoTrack;

export type StagePip = {
  track: StageVideoTrack;
  key: string;
  /** Зеркалить (только собственная камера). */
  mirrored: boolean;
};

export type CallStage = {
  main: StageVideoTrack | null;
  mainKind: "screen" | "camera" | null;
  /** Зеркалить main (когда на нём собственная камера). */
  mainMirrored: boolean;
  pips: StagePip[];
};

type StageEntry = {
  track: StageVideoTrack | null;
  key: string;
  kind: "screen" | "camera";
  mirrored: boolean;
};

// Порядок очереди на «main»: чужой экран → свой экран → камера собеседника →
// своя камера. Так лицо шарящего никогда не пропадает — оно уходит в PiP.
const MAIN_PRIORITY: ReadonlyArray<Omit<StageEntry, "track"> & { pick: (m: CallMedia) => StageVideoTrack | null }> = [
  { key: "remote-screen", kind: "screen", mirrored: false, pick: (m) => m.remoteScreen },
  { key: "local-screen", kind: "screen", mirrored: false, pick: (m) => m.localScreen },
  { key: "remote-camera", kind: "camera", mirrored: false, pick: (m) => m.remoteCamera },
  { key: "local-camera", kind: "camera", mirrored: true, pick: (m) => m.localCamera },
];

// Порядок PiP: камеру собеседника показываем раньше своей.
const PIP_ORDER = ["remote-camera", "local-camera", "remote-screen", "local-screen"];

/**
 * Раскладывает видеотреки звонка по «main» и стопке PiP — как в Telegram:
 * демонстрация экрана крупно, лица в углу, лицо шарящего не теряется.
 */
export function resolveCallStage(media: CallMedia): CallStage {
  const present = MAIN_PRIORITY.map((p) => ({
    track: p.pick(media),
    key: p.key,
    kind: p.kind,
    mirrored: p.mirrored,
  })).filter((e): e is StageEntry & { track: StageVideoTrack } => Boolean(e.track));

  const mainEntry = present[0] ?? null;

  const pips: StagePip[] = present
    .filter((e) => e !== mainEntry)
    .sort((a, b) => PIP_ORDER.indexOf(a.key) - PIP_ORDER.indexOf(b.key))
    .map((e) => ({ track: e.track, key: e.key, mirrored: e.mirrored }));

  return {
    main: mainEntry?.track ?? null,
    mainKind: mainEntry?.kind ?? null,
    mainMirrored: mainEntry?.mirrored ?? false,
    pips,
  };
}
