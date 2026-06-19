import { useCallback, useMemo, useState } from "react";
import type { MatrixMessage } from "@matrix-platform/matrix-core";

export function isSelectableMessage(message: MatrixMessage): boolean {
  return message.kind !== "system" && !message.deleted;
}

export function useMessageSelection(messages: MatrixMessage[]) {
  const [active, setActive] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const selectableIds = useMemo(
    () => messages.filter(isSelectableMessage).map((message) => message.id),
    [messages],
  );

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const selectedMessages = useMemo(
    () => messages.filter((message) => selectedSet.has(message.id)),
    [messages, selectedSet],
  );

  const clear = useCallback(() => {
    setSelectedIds([]);
    setActive(false);
  }, []);

  const enter = useCallback(() => {
    setActive(true);
  }, []);

  const toggle = useCallback((messageId: string) => {
    setActive(true);
    setSelectedIds((current) =>
      current.includes(messageId)
        ? current.filter((id) => id !== messageId)
        : [...current, messageId],
    );
  }, []);

  const selectRange = useCallback(
    (anchorId: string, targetId: string) => {
      const anchorIndex = selectableIds.indexOf(anchorId);
      const targetIndex = selectableIds.indexOf(targetId);
      if (anchorIndex === -1 || targetIndex === -1) {
        toggle(targetId);
        return;
      }

      const start = Math.min(anchorIndex, targetIndex);
      const end = Math.max(anchorIndex, targetIndex);
      const rangeIds = selectableIds.slice(start, end + 1);
      setActive(true);
      setSelectedIds((current) => Array.from(new Set([...current, ...rangeIds])));
    },
    [selectableIds, toggle],
  );

  const handleClick = useCallback(
    (message: MatrixMessage, event: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }) => {
      if (!isSelectableMessage(message)) return;

      const extend = event.shiftKey || event.metaKey || event.ctrlKey;
      if (!active && !extend) return;

      if (event.shiftKey && selectedIds.length > 0) {
        selectRange(selectedIds[selectedIds.length - 1] ?? message.id, message.id);
        return;
      }

      if (event.metaKey || event.ctrlKey || active) {
        toggle(message.id);
      }
    },
    [active, selectRange, selectedIds, toggle],
  );

  return {
    active,
    selectedIds,
    selectedSet,
    selectedMessages,
    enter,
    clear,
    toggle,
    handleClick,
  };
}
