import { useCallback, useEffect, useRef, useState } from "react";

type VoiceRecorderState = "idle" | "recording" | "unsupported";

type Result = {
  state: VoiceRecorderState;
  elapsedMs: number;
  levels: number[];
  start: () => Promise<void>;
  stop: () => Promise<Blob | null>;
  cancel: () => void;
};

const MAX_MS = 300_000;
const LEVEL_HISTORY = 48;

export function useVoiceRecorder(): Result {
  const [state, setState] = useState<VoiceRecorderState>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [levels, setLevels] = useState<number[]>([]);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopRef = useRef<(() => Promise<Blob | null>) | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const startedAtRef = useRef(0);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    analyserRef.current = null;
    void audioContextRef.current?.close().catch(() => undefined);
    audioContextRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
    setElapsedMs(0);
    setLevels([]);
    setState("idle");
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const stop = useCallback(async (): Promise<Blob | null> => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      cleanup();
      return null;
    }

    const blob = await new Promise<Blob | null>((resolve) => {
      recorder.onstop = () => {
        const type = recorder.mimeType || "audio/webm";
        const data = chunksRef.current;
        resolve(data.length > 0 ? new Blob(data, { type }) : null);
      };
      recorder.stop();
    });

    cleanup();
    return blob;
  }, [cleanup]);

  useEffect(() => {
    stopRef.current = stop;
  }, [stop]);

  const start = useCallback(async () => {
    if (state === "recording") return;
    if (!window.MediaRecorder || !navigator.mediaDevices?.getUserMedia) {
      setState("unsupported");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.start(250);
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      setElapsedMs(0);
      setLevels([]);
      setState("recording");

      timerRef.current = window.setInterval(() => {
        const nextElapsed = Date.now() - startedAtRef.current;
        if (nextElapsed >= MAX_MS) {
          void stopRef.current?.();
          return;
        }

        setElapsedMs(nextElapsed);

        const node = analyserRef.current;
        if (node) {
          const bins = new Uint8Array(node.frequencyBinCount);
          node.getByteFrequencyData(bins);
          let sum = 0;
          for (let index = 0; index < bins.length; index += 1) {
            sum += bins[index] ?? 0;
          }
          const level = sum / bins.length / 255;
          setLevels((current) => [...current.slice(-(LEVEL_HISTORY - 1)), level]);
        }
      }, 100);
    } catch (error) {
      console.error("[voice-recorder]", error);
      cleanup();
      setState("unsupported");
    }
  }, [cleanup, state]);

  const cancel = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      recorder.stop();
    }
    cleanup();
  }, [cleanup]);

  return { state, elapsedMs, levels, start, stop, cancel };
}
