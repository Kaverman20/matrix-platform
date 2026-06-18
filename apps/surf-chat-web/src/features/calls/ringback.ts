/**
 * Outgoing ringback tone ("гудки") synthesized with WebAudio — no asset, no
 * autoplay-file issues. Russian/European cadence: 425 Hz, ~1s on / 4s off.
 * Start it from the Phone-click gesture so the AudioContext is allowed to run.
 */
export type Ringback = { stop: () => void };

const TONE_HZ = 425;
const TONE_GAIN = 0.06;
const ON_SECONDS = 1;
const CYCLE_MS = 5000;

export function startRingback(): Ringback {
  let ctx: AudioContext | null = null;
  let osc: OscillatorNode | null = null;
  let gain: GainNode | null = null;
  let interval: number | null = null;
  let stopped = false;

  try {
    ctx = new AudioContext();
    // Created after async connect (outside the raw click), so it may start
    // suspended — resume it. Still allowed: the call began from a user gesture.
    void ctx.resume();
    osc = ctx.createOscillator();
    gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = TONE_HZ;
    gain.gain.value = 0;
    osc.connect(gain).connect(ctx.destination);
    osc.start();

    const pulse = () => {
      if (!ctx || !gain || stopped) return;
      const now = ctx.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(TONE_GAIN, now);
      gain.gain.setValueAtTime(0, now + ON_SECONDS);
    };
    pulse();
    interval = window.setInterval(pulse, CYCLE_MS);
  } catch {
    // WebAudio unavailable — silent fallback (call still works, just no tone).
  }

  return {
    stop() {
      stopped = true;
      if (interval) window.clearInterval(interval);
      try {
        osc?.stop();
      } catch {
        // already stopped
      }
      void ctx?.close();
    },
  };
}
