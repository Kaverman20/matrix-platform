import type { ThemePreview } from "./themePresets";

type Props = {
  preview: ThemePreview;
};

export function ThemeSwatch({ preview }: Props) {
  return (
    <span className="settings-swatch" style={{ background: preview.bg }} aria-hidden>
      <span
        className="settings-swatch__dot"
        style={preview.dot ? { background: preview.dot } : undefined}
      />
      <span className="settings-swatch__aa" style={{ color: preview.text }}>Aa</span>
    </span>
  );
}
