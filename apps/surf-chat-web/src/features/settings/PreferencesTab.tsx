import type { ReactNode } from "react";
import type { SurfPreferences } from "../../app/providers/usePreferences";
import { usePreferences } from "../../app/providers/usePreferences";
import {
  primeNotificationSound,
  playNotificationSound,
} from "../../app/sounds/notificationSound";

type BoolKey = {
  [K in keyof SurfPreferences]: SurfPreferences[K] extends boolean ? K : never;
}[keyof SurfPreferences];

export function PreferencesTab() {
  const { preferences, setPreference } = usePreferences();

  const toggle = (key: BoolKey, label: string, hint?: ReactNode) => (
    <div className="settings-row">
      <div className="settings-row__text">
        <span className="settings-row__label">{label}</span>
        {hint && <span className="settings-row__hint">{hint}</span>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={preferences[key]}
        aria-label={label}
        className={`settings-switch${preferences[key] ? " is-on" : ""}`}
        onClick={() => setPreference(key, !preferences[key])}
      >
        <span className="settings-switch__knob" />
      </button>
    </div>
  );

  return (
    <div className="settings-tab">
      <h2 className="settings-tab__title">Настройки</h2>

      <div className="settings-list">
        {toggle(
          "enterToSend",
          "Enter отправляет сообщение",
          preferences.enterToSend ? "Shift+Enter — новая строка" : "Ctrl+Enter (⌘+Enter) — отправить",
        )}
        {toggle("use24HourTime", "24-часовой формат времени")}
        {toggle("showTypingIndicator", "Показывать «печатает…»")}
        {toggle("showReadReceipts", "Показывать статус прочтения")}
        {toggle(
          "notificationSound",
          "Звук при новом сообщении",
          "Кроме открытого чата, когда вкладка активна",
        )}
        {preferences.notificationSound && (
          <div className="settings-row">
            <div className="settings-row__text">
              <span className="settings-row__label">Громкость уведомления</span>
              <span className="settings-row__hint">
                {Math.round(preferences.notificationVolume * 100)}%
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={preferences.notificationVolume}
                aria-label="Громкость уведомления"
                onChange={(event) =>
                  setPreference("notificationVolume", Number(event.target.value))
                }
              />
              <button
                type="button"
                style={{
                  padding: "4px 12px",
                  fontSize: 13,
                  borderRadius: 8,
                  border: "1px solid var(--color-border)",
                  background: "var(--color-bg-subtle)",
                  color: "var(--color-text)",
                  cursor: "pointer",
                }}
                onClick={() => {
                  // Первый клик заодно разблокирует аудио (autoplay-политика).
                  primeNotificationSound();
                  playNotificationSound(preferences.notificationVolume);
                }}
              >
                Проверить
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
