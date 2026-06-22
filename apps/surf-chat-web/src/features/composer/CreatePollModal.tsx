import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, X } from "lucide-react";
import { transition } from "@matrix-platform/ui";
import type { PollStartInput } from "@matrix-platform/matrix-core";

const MAX_ANSWERS = 10;

type Props = {
  onSubmit: (input: PollStartInput) => void | Promise<void>;
  onClose: () => void;
};

export function CreatePollModal({ onSubmit, onClose }: Props) {
  const [question, setQuestion] = useState("");
  const [answers, setAnswers] = useState<string[]>(["", ""]);
  const [multiple, setMultiple] = useState(false);
  const [anonymous, setAnonymous] = useState(false);
  const [pending, setPending] = useState(false);

  const filledAnswers = answers.map((a) => a.trim()).filter(Boolean);
  const canSubmit = question.trim().length > 0 && filledAnswers.length >= 2;

  const setAnswer = (index: number, value: string) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[index] = value;
      // Auto-grow: typing in the last empty slot reveals one more.
      if (value.trim() && index === next.length - 1 && next.length < MAX_ANSWERS) {
        next.push("");
      }
      return next;
    });
  };

  const removeAnswer = (index: number) => {
    setAnswers((prev) => (prev.length <= 2 ? prev : prev.filter((_, i) => i !== index)));
  };

  const submit = async () => {
    if (!canSubmit || pending) return;
    setPending(true);
    try {
      await onSubmit({
        question: question.trim(),
        answers: filledAnswers,
        maxSelections: multiple ? filledAnswers.length : 1,
        kind: anonymous ? "undisclosed" : "disclosed",
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <motion.div
      className="surf-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="surf-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Создать опрос"
        onClick={(event) => event.stopPropagation()}
        initial={{ scale: 0.94, opacity: 0, y: 8 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.94, opacity: 0, y: 8 }}
        transition={transition.base}
      >
        <button className="surf-dialog__close" onClick={onClose} aria-label="Закрыть">
          <X size={18} />
        </button>

        <div className="surf-dialog__title">Новый опрос</div>

        <input
          autoFocus
          className="surf-input surf-input--underline"
          placeholder="Вопрос"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          maxLength={340}
        />

        <div className="poll-answers">
          {answers.map((answer, index) => (
            <div className="poll-answers__row" key={index}>
              <input
                className="surf-input"
                placeholder={`Вариант ${index + 1}`}
                value={answer}
                maxLength={100}
                onChange={(event) => setAnswer(index, event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && canSubmit) void submit();
                }}
              />
              {answers.length > 2 && answer.trim() && (
                <button
                  type="button"
                  className="poll-answers__remove"
                  title="Удалить вариант"
                  onClick={() => removeAnswer(index)}
                >
                  <X size={15} />
                </button>
              )}
            </div>
          ))}
          {answers.length < MAX_ANSWERS && answers.every((a) => a.trim()) && (
            <button
              type="button"
              className="poll-answers__add"
              onClick={() => setAnswers((prev) => [...prev, ""])}
            >
              <Plus size={15} /> Добавить вариант
            </button>
          )}
        </div>

        <label className="poll-toggle">
          <input type="checkbox" checked={multiple} onChange={(e) => setMultiple(e.target.checked)} />
          <span>Несколько ответов</span>
        </label>
        <label className="poll-toggle">
          <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
          <span>Анонимный опрос</span>
        </label>

        <button
          className="surf-btn surf-btn--primary surf-btn--block"
          onClick={() => void submit()}
          disabled={!canSubmit || pending}
        >
          {pending ? "Создаём…" : "Создать опрос"}
        </button>
      </motion.div>
    </motion.div>
  );
}
