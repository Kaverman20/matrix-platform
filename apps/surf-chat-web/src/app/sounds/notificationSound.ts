// Notification "blip" synthesized with WebAudio — no asset file to ship, and a
// single shared AudioContext we can "prime" (resume) on the first user gesture
// to satisfy browser autoplay policies.

let ctx: AudioContext | null = null;
let primed = false;

type AudioContextCtor = typeof AudioContext;

function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === "undefined") return null;
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext ??
    null
  );
}

function ensureContext(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor = getAudioContextCtor();
  if (!Ctor) return null;
  ctx = new Ctor();
  return ctx;
}

/**
 * Unlock audio on a user gesture (Chrome/Safari block playback until then).
 * Safe to call repeatedly; only the first call does work.
 */
export function primeNotificationSound(): void {
  if (primed) return;
  const audio = ensureContext();
  if (!audio) return;
  primed = true;
  void audio.resume().catch(() => undefined);
}

/** Play a short two-tone notification blip. No-op if audio isn't unlocked. */
export function playNotificationSound(): void {
  const audio = ctx;
  if (!audio || audio.state !== "running") return;

  const now = audio.currentTime;
  const master = audio.createGain();
  // Общая громкость блипа. Каждый тон ниже имеет свою attack/decay-огибающую,
  // так что мастеру огибающая не нужна — это просто уровень. (Был баг: стоял
  // 0.0001 как у стартовых точек огибающих → звук получался почти неслышным.)
  master.gain.value = 0.5;
  master.connect(audio.destination);

  // Two quick rising tones — recognizable, not jarring.
  const tones: Array<{ freq: number; at: number; dur: number }> = [
    { freq: 660, at: 0, dur: 0.12 },
    { freq: 880, at: 0.1, dur: 0.16 },
  ];

  for (const tone of tones) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = "sine";
    osc.frequency.value = tone.freq;
    const start = now + tone.at;
    const end = start + tone.dur;
    // Soft attack/decay envelope to avoid clicks.
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.18, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.connect(gain).connect(master);
    osc.start(start);
    osc.stop(end + 0.02);
  }
}
