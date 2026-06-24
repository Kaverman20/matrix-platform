import type { ReactNode } from "react";
import type { SurfPreferences } from "../../app/providers/usePreferences";
import { usePreferences } from "../../app/providers/usePreferences";

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
      </div>
    </div>
  );
}
