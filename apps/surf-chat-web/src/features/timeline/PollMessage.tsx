import { useState } from "react";
import type { MatrixPoll } from "@matrix-platform/matrix-core";
import "./poll-message.css";

type Props = {
  poll: MatrixPoll;
  disabled?: boolean;
  onVote: (answerIds: string[]) => void | Promise<void>;
};

export function PollMessage({ poll, disabled = false, onVote }: Props) {
  const [pending, setPending] = useState<string[]>(poll.mySelections);
  const hasVoted = poll.mySelections.length > 0;
  const showResults = poll.kind === "disclosed" || hasVoted || poll.closed;

  const toggle = (answerId: string) => {
    if (disabled || poll.closed || hasVoted) return;
    setPending((current) => {
      if (poll.maxSelections <= 1) return [answerId];
      return current.includes(answerId)
        ? current.filter((id) => id !== answerId)
        : current.length >= poll.maxSelections
          ? current
          : [...current, answerId];
    });
  };

  const submit = () => {
    if (disabled || poll.closed || pending.length === 0) return;
    void onVote(pending);
  };

  return (
    <div className="poll-message">
      <strong className="poll-message__question">{poll.question}</strong>
      <div className="poll-message__options">
        {poll.answers.map((answer) => {
          const selected = pending.includes(answer.id) || poll.mySelections.includes(answer.id);
          const votes = poll.voteCounts[answer.id] ?? 0;
          const percent = poll.totalVotes > 0 ? Math.round((votes / poll.totalVotes) * 100) : 0;

          return (
            <button
              key={answer.id}
              type="button"
              className={`poll-message__option${selected ? " is-selected" : ""}`}
              disabled={disabled || poll.closed || hasVoted}
              onClick={() => toggle(answer.id)}
            >
              {showResults && (
                <span
                  className="poll-message__bar"
                  style={{ width: `${Math.max(percent, selected ? 8 : 0)}%` }}
                />
              )}
              <span className="poll-message__option-text">{answer.text}</span>
              {showResults && <span className="poll-message__percent">{percent}%</span>}
            </button>
          );
        })}
      </div>
      <div className="poll-message__meta">
        {poll.totalVotes > 0 ? `${poll.totalVotes} голосов` : "Пока нет голосов"}
        {poll.closed ? " · завершён" : null}
      </div>
      {!hasVoted && !poll.closed && (
        <button
          type="button"
          className="poll-message__submit"
          disabled={disabled || pending.length === 0}
          onClick={submit}
        >
          Проголосовать
        </button>
      )}
    </div>
  );
}
