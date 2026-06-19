const MATRIX_WAVEFORM_MAX = 1024;
const DEFAULT_BAR_COUNT = 48;

/** Downsample raw amplitude samples to Matrix waveform integers (0–1024). */
export function amplitudesToMatrixWaveform(samples: number[], count = 100): number[] {
  if (samples.length === 0) return [];
  const step = samples.length / count;
  const result: number[] = [];

  for (let index = 0; index < count; index += 1) {
    const start = Math.floor(index * step);
    const end = Math.max(start + 1, Math.floor((index + 1) * step));
    let peak = 0;
    for (let i = start; i < end && i < samples.length; i += 1) {
      peak = Math.max(peak, Math.abs(samples[i] ?? 0));
    }
    result.push(Math.round(Math.min(1, peak) * MATRIX_WAVEFORM_MAX));
  }

  return result;
}

/** Decode audio and build a Matrix-compatible waveform. */
export async function waveformFromBlob(blob: Blob, count = 100): Promise<number[]> {
  if (!blob.size) return [];

  try {
    const context = new AudioContext();
    const buffer = await context.decodeAudioData(await blob.arrayBuffer());
    await context.close();

    const channel = buffer.getChannelData(0);
    const blockSize = Math.max(1, Math.floor(channel.length / (count * 4)));
    const peaks: number[] = [];

    for (let index = 0; index < channel.length; index += blockSize) {
      let peak = 0;
      const end = Math.min(channel.length, index + blockSize);
      for (let i = index; i < end; i += 1) {
        peak = Math.max(peak, Math.abs(channel[i] ?? 0));
      }
      peaks.push(peak);
    }

    return amplitudesToMatrixWaveform(peaks, count);
  } catch (error) {
    console.warn("[waveform] decode failed", error);
    return [];
  }
}

/** Resample Matrix waveform values to normalized bar heights (0–1). */
export function waveformToBars(waveform: number[] | undefined, barCount = DEFAULT_BAR_COUNT, seed = ""): number[] {
  if (waveform && waveform.length > 0) {
    const step = waveform.length / barCount;
    return Array.from({ length: barCount }, (_, index) => {
      const value = waveform[Math.floor(index * step)] ?? 0;
      return Math.max(0.12, Math.min(1, value / MATRIX_WAVEFORM_MAX));
    });
  }
  return pseudoWaveform(seed, barCount);
}

function pseudoWaveform(seed: string, count: number): number[] {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }

  return Array.from({ length: count }, () => {
    hash = (hash * 1664525 + 1013904223) >>> 0;
    return 0.14 + ((hash % 1000) / 1000) * 0.86;
  });
}

export function formatVoiceTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

export function formatRecordingTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  const tenths = Math.floor((ms % 1000) / 100);
  return `${mins}:${String(secs).padStart(2, "0")},${tenths}`;
}
