import type { MatrixMentionMember } from "@matrix-platform/matrix-core";

type Props = {
  candidates: readonly MatrixMentionMember[];
  activeIndex: number;
  onSelect: (member: MatrixMentionMember) => void;
};

export function MentionAutocomplete({ candidates, activeIndex, onSelect }: Props) {
  if (candidates.length === 0) return null;

  return (
    <div className="composer-mentions" role="listbox" aria-label="Упоминания">
      {candidates.map((member, index) => (
        <button
          key={member.userId}
          type="button"
          role="option"
          aria-selected={index === activeIndex}
          className={`composer-mentions__item${index === activeIndex ? " is-active" : ""}`}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onSelect(member)}
        >
          <span className="composer-mentions__name">{member.name}</span>
          <span className="composer-mentions__id">{member.userId}</span>
        </button>
      ))}
    </div>
  );
}
