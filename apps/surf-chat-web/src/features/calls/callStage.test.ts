import { describe, expect, it } from "vitest";
import type { LocalVideoTrack, RemoteVideoTrack } from "livekit-client";
import { resolveCallStage } from "./callStage";
import type { CallMedia } from "./useRoomCall";

// Фейковые треки — функция только проверяет наличие и возвращает те же ссылки.
const localCamera = { id: "local-camera" } as unknown as LocalVideoTrack;
const localScreen = { id: "local-screen" } as unknown as LocalVideoTrack;
const remoteCamera = { id: "remote-camera" } as unknown as RemoteVideoTrack;
const remoteScreen = { id: "remote-screen" } as unknown as RemoteVideoTrack;

const media = (over: Partial<CallMedia>): CallMedia => ({
  localCamera: null,
  localScreen: null,
  remoteCamera: null,
  remoteScreen: null,
  ...over,
});

describe("resolveCallStage", () => {
  it("аудиозвонок без видео — пустая сцена", () => {
    const stage = resolveCallStage(media({}));
    expect(stage.main).toBeNull();
    expect(stage.mainKind).toBeNull();
    expect(stage.pips).toEqual([]);
  });

  it("видеозвонок: main — камера собеседника, PiP — своя (зеркальная)", () => {
    const stage = resolveCallStage(media({ remoteCamera, localCamera }));
    expect(stage.main).toBe(remoteCamera);
    expect(stage.mainKind).toBe("camera");
    expect(stage.pips).toEqual([{ track: localCamera, key: "local-camera", mirrored: true }]);
  });

  it("я шарю экран: main — мой экран, лицо собеседника и моё в PiP", () => {
    const stage = resolveCallStage(media({ localScreen, remoteCamera, localCamera }));
    expect(stage.main).toBe(localScreen);
    expect(stage.mainKind).toBe("screen");
    expect(stage.pips.map((p) => p.key)).toEqual(["remote-camera", "local-camera"]);
  });

  it("собеседник шарит экран: main — его экран, его лицо не пропадает", () => {
    const stage = resolveCallStage(media({ remoteScreen, remoteCamera, localCamera }));
    expect(stage.main).toBe(remoteScreen);
    expect(stage.mainKind).toBe("screen");
    expect(stage.pips.map((p) => p.key)).toEqual(["remote-camera", "local-camera"]);
  });

  it("чужой экран приоритетнее своего на main", () => {
    const stage = resolveCallStage(media({ remoteScreen, localScreen }));
    expect(stage.main).toBe(remoteScreen);
    expect(stage.pips.map((p) => p.key)).toEqual(["local-screen"]);
  });

  it("только своя камера (собеседник ещё без видео) — main зеркальный, без PiP", () => {
    const stage = resolveCallStage(media({ localCamera }));
    expect(stage.main).toBe(localCamera);
    expect(stage.mainKind).toBe("camera");
    expect(stage.mainMirrored).toBe(true);
    expect(stage.pips).toEqual([]);
  });

  it("камера собеседника на main не зеркалится", () => {
    const stage = resolveCallStage(media({ remoteCamera, localCamera }));
    expect(stage.mainMirrored).toBe(false);
  });
});
