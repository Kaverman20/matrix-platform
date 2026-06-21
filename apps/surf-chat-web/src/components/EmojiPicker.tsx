import { lazy, Suspense } from "react";
import { usePreferences } from "../app/providers/usePreferences";
import { isDarkPreset, resolveThemePreset } from "../app/providers/themePresets";

type EmojiPickerProps = {
  onSelect: (native: string) => void;
};

type EmojiMartProps = EmojiPickerProps & {
  theme: "light" | "dark";
};

// emoji-mart + its data set is ~510 kB. Load it only when a picker actually
// opens so it stays off the initial bundle path. The Russian i18n is bundled
// too (instead of letting emoji-mart fetch it from jsdelivr) — the production
// CSP blocks that CDN, which would otherwise leave the picker blank.
const LazyEmojiMart = lazy(async () => {
  const [{ default: Picker }, { default: data }, { default: i18n }] = await Promise.all([
    import("@emoji-mart/react"),
    import("@emoji-mart/data"),
    import("@emoji-mart/data/i18n/ru.json"),
  ]);

  function EmojiMart({ onSelect, theme }: EmojiMartProps) {
    return (
      <Picker
        data={data}
        i18n={i18n}
        onEmojiSelect={(event: { native: string }) => onSelect(event.native)}
        theme={theme}
        locale="ru"
        navPosition="bottom"
        previewPosition="none"
        skinTonePosition="none"
        maxFrequentRows={2}
      />
    );
  }

  return { default: EmojiMart };
});

/** Lazily-loaded emoji picker. Renders nothing until the chunk arrives. Picker
 * theme follows the active app theme (dark presets → dark picker). */
export function EmojiPicker({ onSelect }: EmojiPickerProps) {
  const { preferences } = usePreferences();
  const theme = isDarkPreset(resolveThemePreset(preferences.theme)) ? "dark" : "light";

  return (
    <Suspense fallback={null}>
      <LazyEmojiMart onSelect={onSelect} theme={theme} />
    </Suspense>
  );
}
