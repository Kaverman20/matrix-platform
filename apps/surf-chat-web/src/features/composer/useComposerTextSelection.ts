import { useCallback, useState } from "react";

export type ComposerSelection = {
  start: number;
  end: number;
  hasSelection: boolean;
};

export function useComposerTextSelection() {
  const [selection, setSelection] = useState<ComposerSelection>({
    start: 0,
    end: 0,
    hasSelection: false,
  });

  const syncSelection = useCallback((textarea: HTMLTextAreaElement | null) => {
    if (!textarea) return;
    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;
    setSelection({
      start,
      end,
      hasSelection: start !== end,
    });
  }, []);

  return { selection, syncSelection };
}
