import { Check } from "lucide-react";

type Props = {
  selected: boolean;
};

/** Telegram-style circular checkmark on the right edge of a selectable row. */
export function MessageSelectMark({ selected }: Props) {
  return (
    <span className={`message-select-mark${selected ? " is-selected" : ""}`} aria-hidden="true">
      {selected && <Check size={12} strokeWidth={2.75} />}
    </span>
  );
}
