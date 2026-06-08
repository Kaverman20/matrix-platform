import type { MatrixReaction } from "@matrix-platform/matrix-core";
import "./reaction-pill.css";

type Props = {
  reaction: MatrixReaction;
  onToggle: () => void;
};

export function ReactionPill({ reaction, onToggle }: Props) {
  const names = reaction.senders.slice(0, 4).join(", ");

  return (
    <button
      type="button"
      className={`reaction-pill${reaction.mine ? " is-mine" : ""}`}
      title={names}
      aria-pressed={reaction.mine}
      onClick={onToggle}
    >
      <span>{reaction.key}</span>
      <strong>{reaction.count}</strong>
    </button>
  );
}
