import { dayLabel } from "./timelineDates";

export function DayDivider({ timestamp }: { timestamp: number }) {
  return (
    <div className="day-divider">
      <span>{dayLabel(timestamp)}</span>
    </div>
  );
}

export function UnreadDivider() {
  return (
    <div className="unread-divider">
      <span>Новые сообщения</span>
    </div>
  );
}
