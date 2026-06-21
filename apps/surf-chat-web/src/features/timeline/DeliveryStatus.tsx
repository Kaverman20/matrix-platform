import { AlertCircle, Check, CheckCheck, Clock3 } from "lucide-react";
import type { MouseEvent as ReactMouseEvent } from "react";
import type { MatrixMessage } from "@matrix-platform/matrix-core";
import { usePreferences } from "../../app/providers/usePreferences";

export function DeliveryStatus({
  status = "sent",
  compact = false,
  onShowReaders,
}: {
  status?: MatrixMessage["deliveryStatus"];
  compact?: boolean;
  onShowReaders?: (anchorRect: DOMRect) => void;
}) {
  const { preferences } = usePreferences();
  const effectiveStatus = status === "read" && !preferences.showReadReceipts ? "sent" : status;
  const size = compact ? 13 : 14;
  const className = `message__delivery message__delivery--${effectiveStatus}`;
  const canShowReaders = effectiveStatus === "read" && onShowReaders;

  const handleClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (!canShowReaders) return;
    event.stopPropagation();
    onShowReaders(event.currentTarget.getBoundingClientRect());
  };

  const iconProps = {
    size,
    className: className,
  };

  if (canShowReaders) {
    return (
      <button type="button" className="message__delivery-btn" onClick={handleClick} aria-label="Кто прочитал">
        <CheckCheck {...iconProps} />
      </button>
    );
  }

  switch (effectiveStatus) {
    case "sending":
      return <Clock3 size={size} className={className} aria-label="Отправляется" />;
    case "read":
      return <CheckCheck size={size} className={className} aria-label="Прочитано" />;
    case "error":
      return <AlertCircle size={size} className={className} aria-label="Ошибка отправки" />;
    case "sent":
    default:
      return <Check size={size} className={className} aria-label="Отправлено" />;
  }
}
