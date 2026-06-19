type Props = {
  levels: number[];
  barCount?: number;
};

export function RecordingWaveform({ levels, barCount = 36 }: Props) {
  const bars = Array.from({ length: barCount }, (_, index) => {
    const levelIndex = levels.length - barCount + index;
    const level = levelIndex >= 0 ? levels[levelIndex] ?? 0 : 0;
    return Math.max(0.12, Math.min(1, level));
  });

  return (
    <div className="composer__voice-wave" aria-hidden="true">
      {bars.map((height, index) => (
        <span
          key={index}
          className="composer__voice-bar"
          style={{ height: `${Math.round(height * 100)}%` }}
        />
      ))}
    </div>
  );
}
