import { useCallback, useMemo, useState } from "react";
import {
  applyMentionSelection,
  filterMentionCandidates,
  findMentionTrigger,
  type MatrixMentionMember,
} from "@matrix-platform/matrix-core";

type Options = {
  members: readonly MatrixMentionMember[];
  excludeUserId?: string | null;
};

export function useMentionAutocomplete({ members, excludeUserId }: Options) {
  const [open, setOpen] = useState(false);
  const [triggerStart, setTriggerStart] = useState(0);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const candidates = useMemo(
    () => filterMentionCandidates(query, members, excludeUserId),
    [excludeUserId, members, query],
  );

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  }, []);

  const syncFromDraft = useCallback((text: string, cursor: number) => {
    const trigger = findMentionTrigger(text, cursor);
    if (!trigger) {
      close();
      return;
    }
    setOpen(true);
    setTriggerStart(trigger.start);
    setQuery(trigger.query);
    setActiveIndex(0);
  }, [close]);

  const applySelection = useCallback((
    text: string,
    cursor: number,
    member: MatrixMentionMember,
  ) => {
    const next = applyMentionSelection(text, triggerStart, cursor, member);
    close();
    return next;
  }, [close, triggerStart]);

  const moveActive = useCallback((delta: number) => {
    if (!open || candidates.length === 0) return;
    setActiveIndex((index) => (index + delta + candidates.length) % candidates.length);
  }, [candidates.length, open]);

  const activeCandidate = open ? candidates[activeIndex] ?? null : null;

  return {
    open,
    candidates,
    activeIndex,
    activeCandidate,
    close,
    syncFromDraft,
    applySelection,
    moveActive,
  };
}
