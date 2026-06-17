/** Single source of truth for short HH:MM message timestamps.
 *
 * `hour24` forces 24-hour output; when omitted the browser locale decides
 * (preserving the previous default behaviour). Used by the timeline / room-list
 * mappers and re-derived in the web app when the user flips the time format. */
export function formatDisplayTime(
  timestamp: number,
  opts?: { hour24?: boolean },
): string {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    ...(opts?.hour24 === undefined ? {} : { hour12: !opts.hour24 }),
  });
}
