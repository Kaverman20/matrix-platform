import { EventType, type MatrixClient } from "matrix-js-sdk";
import type { CallIntent } from "./rtcSession";

/** Marker key on the call-summary message so the timeline renders it specially. */
export const CALL_SUMMARY_KEY = "run.foxhound.call_summary";

export type CallSummary = {
  /** Whether the peer actually joined (vs cancelled / no answer / declined). */
  answered: boolean;
  durationSec: number;
  intent: CallIntent;
  /** Outgoing caller reached a busy peer (Telegram-style «Занят»). */
  busy?: boolean;
};

type CallSummaryMarker = {
  answered: boolean;
  duration_ms: number;
  intent: CallIntent;
  busy?: boolean;
};

/** Posts a call-history line to the room. Only the caller sends it, so a 1:1
 * call produces exactly one entry, localized per viewer at render time. */
export async function sendCallSummary(
  client: MatrixClient,
  roomId: string,
  summary: CallSummary,
): Promise<void> {
  const marker: CallSummaryMarker = {
    answered: summary.answered,
    duration_ms: Math.max(0, Math.round(summary.durationSec * 1000)),
    intent: summary.intent,
    ...(summary.busy ? { busy: true } : {}),
  };
  await client.sendEvent(roomId, EventType.RoomMessage, {
    // Plain-text fallback for clients that don't understand the marker.
    msgtype: "m.notice",
    body: summary.busy
      ? `${summary.intent === "video" ? "📹" : "📞"} Занят`
      : summary.answered
        ? `${summary.intent === "video" ? "📹" : "📞"} Звонок · ${formatDurationShort(summary.durationSec)}`
        : `${summary.intent === "video" ? "📹" : "📞"} Пропущенный звонок`,
    [CALL_SUMMARY_KEY]: marker,
  } as never);
}

/** Parses the call-summary marker off a message event's content, or null. */
export function parseCallSummary(content: Record<string, unknown>): CallSummary | null {
  const marker = content[CALL_SUMMARY_KEY] as CallSummaryMarker | undefined;
  if (!marker || typeof marker.answered !== "boolean") return null;
  return {
    answered: marker.answered,
    durationSec: typeof marker.duration_ms === "number" ? marker.duration_ms / 1000 : 0,
    intent: marker.intent === "video" ? "video" : "audio",
    busy: marker.busy === true,
  };
}

/** Localized one-line summary for the timeline, from the viewer's perspective. */
export function formatCallSummaryLine(summary: CallSummary, own: boolean): string {
  const icon = summary.intent === "video" ? "📹" : "📞";
  if (!summary.answered && summary.busy && own) {
    return `${icon} Занят`;
  }
  if (!summary.answered) {
    return own ? `${icon} Отменённый звонок` : `${icon} Пропущенный звонок`;
  }
  const direction = own ? "Исходящий" : "Входящий";
  return `${icon} ${direction} звонок · ${formatDurationShort(summary.durationSec)}`;
}

function formatDurationShort(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const ss = String(seconds).padStart(2, "0");
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${ss}`;
  return `${minutes}:${ss}`;
}
