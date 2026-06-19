import { X } from "lucide-react";
import type { MessageEditEntry } from "@matrix-platform/matrix-core";
import { MessageBody } from "./MessageBody";
import { useTimeFormatter } from "../settings/usePreferences";
import "./edit-history-modal.css";

type Props = {
  entries: MessageEditEntry[];
  onClose: () => void;
};

export function EditHistoryModal({ entries, onClose }: Props) {
  const formatTime = useTimeFormatter();

  return (
    <div className="edit-history-modal" role="dialog" aria-modal="true" aria-label="История изменений">
      <button type="button" className="edit-history-modal__backdrop" aria-label="Закрыть" onClick={onClose} />
      <div className="edit-history-modal__panel">
        <header className="edit-history-modal__head">
          <strong>История изменений</strong>
          <button type="button" onClick={onClose} aria-label="Закрыть">
            <X size={18} />
          </button>
        </header>
        <ul className="edit-history-modal__list">
          {entries.map((entry) => (
            <li key={entry.eventId}>
              <time>{formatTime(entry.timestamp)}</time>
              <MessageBody text={entry.body} formattedBody={entry.formattedBody} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
