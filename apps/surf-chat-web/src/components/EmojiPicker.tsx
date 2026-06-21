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
// opens so it stays off the initial bundle path.
const LazyEmojiMart = lazy(async () => {
  const [{ default: Picker }, { default: data }] = await Promise.all([
    import("@emoji-mart/react"),
    import("@emoji-mart/data"),
  ]);

  function EmojiMart({ onSelect, theme }: EmojiMartProps) {
    return (
      <Picker
        data={data}
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
