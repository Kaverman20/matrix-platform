/**
 * Incoming-call ringtone ("мелодия входящего") synthesized with WebAudio — no
 * asset. Distinct from the outgoing ringback: a two-burst cadence (~480 Hz)
 * repeating every 3s, like a classic phone.
 *
 * NOTE: this plays without a fresh user gesture, so a strict browser may keep
 * the AudioContext suspended until the user has interacted with the page. We
 * call resume() and degrade silently — the incoming UI still shows.
 */
export type Ringtone = { stop: () => void };

const TONE_HZ = 480;
const TONE_GAIN = 0.08;
const CYCLE_MS = 3000;

export function startRingtone(): Ringtone {
  let ctx: AudioContext | null = null;
  let osc: OscillatorNode | null = null;
  let gain: GainNode | null = null;
  let interval: number | null = null;
  let stopped = false;

  try {
    ctx = new AudioContext();
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
      // burst — pause — burst, then silence for the rest of the cycle
      gain.gain.setValueAtTime(TONE_GAIN, now);
      gain.gain.setValueAtTime(0, now + 0.4);
      gain.gain.setValueAtTime(TONE_GAIN, now + 0.6);
      gain.gain.setValueAtTime(0, now + 1.0);
    };
    pulse();
    interval = window.setInterval(pulse, CYCLE_MS);
  } catch {
    // WebAudio unavailable — silent fallback.
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
