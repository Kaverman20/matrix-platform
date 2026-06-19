import { Forward, Trash2 } from "lucide-react";
import "./selection-toolbar.css";

type Props = {
  count: number;
  canDelete: boolean;
  onForward: () => void;
  onDelete: () => void;
};

function selectionLabel(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `Выбрано ${count} сообщение`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `Выбрано ${count} сообщения`;
  return `Выбрано ${count} сообщений`;
}

export function SelectionToolbar({ count, canDelete, onForward, onDelete }: Props) {
  if (count === 0) return null;

  return (
    <div className="selection-toolbar" role="toolbar" aria-label="Действия с выбранными сообщениями">
      {canDelete ? (
        <button
          type="button"
          className="selection-toolbar__icon selection-toolbar__icon--danger"
          onClick={onDelete}
          aria-label="Удалить"
          title="Удалить"
        >
          <Trash2 size={20} />
        </button>
      ) : (
        <span className="selection-toolbar__icon selection-toolbar__icon--placeholder" aria-hidden="true" />
      )}
      <span className="selection-toolbar__count">{selectionLabel(count)}</span>
      <button
        type="button"
        className="selection-toolbar__icon"
        onClick={onForward}
        aria-label="Переслать"
        title="Переслать"
      >
        <Forward size={20} />
      </button>
    </div>
  );
}
