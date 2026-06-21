import type { MatrixMessage } from "@matrix-platform/matrix-core";
import { useTimeFormatter } from "../../app/providers/usePreferences";

export function SystemMessage({ message }: { message: MatrixMessage }) {
  const formatTime = useTimeFormatter();
  return (
    <div className="system-message" data-mid={message.id}>
      <span>{message.text}</span>
      <time>{formatTime(message.timestamp)}</time>
    </div>
  );
}
