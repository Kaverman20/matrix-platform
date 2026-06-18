function startOfLocalDay(ms: number): number {
  const date = new Date(ms);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function isValidTimestamp(timestamp: number): boolean {
  return Number.isFinite(timestamp) && timestamp > 0;
}

/** Single source of truth for short HH:MM message timestamps.
 *
 * `hour24` forces 24-hour output; when omitted the browser locale decides
 * (preserving the previous default behaviour). Used by the timeline / room-list
 * mappers and re-derived in the web app when the user flips the time format. */
export function formatDisplayTime(
  timestamp: number,
  opts?: { hour24?: boolean },
): string {
  if (!isValidTimestamp(timestamp)) return "";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    ...(opts?.hour24 === undefined ? {} : { hour12: !opts.hour24 }),
  });
}

/** Sidebar row timestamp: time today, relative labels for recent days, date otherwise. */
export function formatRoomListTime(
  timestamp: number,
  opts?: { hour24?: boolean; now?: number; locale?: string },
): string {
  if (!isValidTimestamp(timestamp)) return "";

  const now = opts?.now ?? Date.now();
  const locale = opts?.locale ?? "ru-RU";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";

  const dayStart = startOfLocalDay(timestamp);
  const todayStart = startOfLocalDay(now);
  const dayMs = 86_400_000;

  if (dayStart === todayStart) {
    return formatDisplayTime(timestamp, opts);
  }

  if (dayStart === todayStart - dayMs) {
    return "Вчера";
  }

  const diffDays = Math.floor((todayStart - dayStart) / dayMs);
  if (diffDays > 0 && diffDays < 7) {
    return date.toLocaleDateString(locale, { weekday: "short" });
  }

  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  if (sameYear) {
    return date.toLocaleDateString(locale, { day: "numeric", month: "short" });
  }

  return date.toLocaleDateString(locale, { day: "numeric", month: "short", year: "2-digit" });
}
