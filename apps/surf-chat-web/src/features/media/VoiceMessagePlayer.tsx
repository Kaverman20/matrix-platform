import { Pause, Play } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatVoiceTime, waveformToBars } from "./waveform";
import "./voice-message.css";

const SPEEDS = [1, 1.5, 2] as const;

type Props = {
  src: string | undefined;
  durationMs?: number;
  waveform?: number[];
  seed?: string;
};

export function VoiceMessagePlayer({ src, durationMs, waveform, seed = "" }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const waveRef = useRef<HTMLDivElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentMs, setCurrentMs] = useState(0);
  const [loadedDurationMs, setLoadedDurationMs] = useState(0);
  const [speedIndex, setSpeedIndex] = useState(0);

  const bars = useMemo(() => waveformToBars(waveform, 48, seed), [seed, waveform]);
  const duration = loadedDurationMs || durationMs || 0;
  const progress = duration > 0 ? Math.min(1, currentMs / duration) : 0;
  const speed = SPEEDS[speedIndex] ?? 1;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => setCurrentMs(Math.round(audio.currentTime * 1000));
    const onMeta = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setLoadedDurationMs(Math.round(audio.duration * 1000));
      }
    };
    const onEnd = () => {
      setPlaying(false);
      setCurrentMs(0);
    };

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnd);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnd);
    };
  }, [src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = speed;
  }, [speed, src]);

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !src) return;

    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }

    try {
      await audio.play();
      setPlaying(true);
    } catch (error) {
      console.warn("[voice-player]", error);
    }
  }, [playing, src]);

  const seek = useCallback(
    (clientX: number) => {
      const audio = audioRef.current;
      const wave = waveRef.current;
      if (!audio || !wave || !duration) return;

      const rect = wave.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      audio.currentTime = (duration * ratio) / 1000;
      setCurrentMs(Math.round(duration * ratio));
    },
    [duration],
  );

  const cycleSpeed = () => {
    setSpeedIndex((value) => (value + 1) % SPEEDS.length);
  };

  const displayMs = playing || currentMs > 0 ? currentMs : duration;

  return (
    <div className="voice-player">
      <audio ref={audioRef} src={src} preload="metadata" hidden />
      <button
        type="button"
        className="voice-player__play"
        aria-label={playing ? "Пауза" : "Воспроизвести"}
        disabled={!src}
        onClick={() => void togglePlay()}
      >
        {playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
      </button>
      <div className="voice-player__body">
        <div
          ref={waveRef}
          className="voice-player__wave"
          role="slider"
          aria-label="Позиция воспроизведения"
          aria-valuemin={0}
          aria-valuemax={duration}
          aria-valuenow={currentMs}
          tabIndex={0}
          onClick={(event) => seek(event.clientX)}
          onKeyDown={(event) => {
            const audio = audioRef.current;
            if (!audio || !duration) return;
            const step = 5000;
            if (event.key === "ArrowRight") {
              audio.currentTime = Math.min(audio.duration, audio.currentTime + step / 1000);
            }
            if (event.key === "ArrowLeft") {
              audio.currentTime = Math.max(0, audio.currentTime - step / 1000);
            }
          }}
        >
          {bars.map((height, index) => {
            const barProgress = (index + 1) / bars.length;
            const played = barProgress <= progress;
            return (
              <span
                key={index}
                className={`voice-player__bar${played ? " is-played" : ""}`}
                style={{ height: `${Math.round(height * 100)}%` }}
              />
            );
          })}
        </div>
        <span className="voice-player__time">{formatVoiceTime(displayMs)}</span>
      </div>
      <button type="button" className="voice-player__speed" title="Скорость" onClick={cycleSpeed}>
        {speed === 1 ? "1×" : `${speed}×`}
      </button>
    </div>
  );
}
