import { Phone, PhoneOff } from "lucide-react";
import "./incoming-call-banner.css";

type Props = {
  callerName: string;
  onAnswer: () => void;
  onDismiss: () => void;
};

/** In-app incoming call banner (MatrixRTC ring, no push). */
export function IncomingCallBanner({ callerName, onAnswer, onDismiss }: Props) {
  return (
    <div className="incoming-call-banner" role="status" aria-live="polite">
      <div className="incoming-call-banner__info">
        <Phone size={16} className="incoming-call-banner__icon" aria-hidden />
        <span>
          <strong>{callerName}</strong> звонит…
        </span>
      </div>
      <div className="incoming-call-banner__actions">
        <button type="button" className="incoming-call-banner__answer" onClick={onAnswer}>
          Ответить
        </button>
        <button
          type="button"
          className="incoming-call-banner__dismiss"
          title="Отклонить"
          onClick={onDismiss}
        >
          <PhoneOff size={16} />
        </button>
      </div>
    </div>
  );
}
