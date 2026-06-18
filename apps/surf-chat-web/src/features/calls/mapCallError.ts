/** Maps LiveKit / network errors to short Russian status text (Telegram-style). */
export function mapCallError(err: unknown): string {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();

  if (msg.includes("signal") && (msg.includes("timed out") || msg.includes("timeout"))) {
    return "Не удалось установить соединение";
  }
  if (msg.includes("could not establish") || msg.includes("connection")) {
    return "Не удалось установить соединение";
  }
  if (msg.includes("permission") || msg.includes("notallowed")) {
    return "Нет доступа к микрофону";
  }
  if (msg.includes("lk-jwt")) {
    return err instanceof Error ? err.message : "Ошибка авторизации звонка";
  }

  return err instanceof Error ? err.message : "Не удалось начать звонок";
}
