import { lazy, Suspense } from "react";

type EmojiPickerProps = {
  onSelect: (native: string) => void;
};

// emoji-mart + its data set is ~510 kB. Load it only when a picker actually
// opens so it stays off the initial bundle path.
const LazyEmojiMart = lazy(async () => {
  const [{ default: Picker }, { default: data }] = await Promise.all([
    import("@emoji-mart/react"),
    import("@emoji-mart/data"),
  ]);

  function EmojiMart({ onSelect }: EmojiPickerProps) {
    return (
      <Picker
        data={data}
        onEmojiSelect={(event: { native: string }) => onSelect(event.native)}
        theme="light"
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

/** Lazily-loaded emoji picker. Renders nothing until the chunk arrives. */
export function EmojiPicker({ onSelect }: EmojiPickerProps) {
  return (
    <Suspense fallback={null}>
      <LazyEmojiMart onSelect={onSelect} />
    </Suspense>
  );
}
