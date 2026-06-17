import type { ThemePreview } from "./themePresets";

type Props = {
  preview: ThemePreview;
};

export function ThemeSwatch({ preview }: Props) {
  if (preview.type === "system") {
    return (
      <span className="settings-swatch settings-swatch--system" aria-hidden>
        <span
          className="settings-swatch__half"
          style={{ background: preview.light.bg, color: preview.light.text }}
        >
          A
        </span>
        <span
          className="settings-swatch__half"
          style={{ background: preview.dark.bg, color: preview.dark.text }}
        >
          a
        </span>
      </span>
    );
  }

  return (
    <span
      className="settings-swatch"
      style={{ background: preview.bg, color: preview.text }}
      aria-hidden
    >
      Aa
    </span>
  );
}
