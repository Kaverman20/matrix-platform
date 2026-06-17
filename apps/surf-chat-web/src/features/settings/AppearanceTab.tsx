import type { ChatView, ThemeMode } from "./usePreferences";
import { usePreferences } from "./usePreferences";

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: "light", label: "Светлая" },
  { value: "dark", label: "Тёмная" },
  { value: "system", label: "Системная" },
];

const VIEW_OPTIONS: { value: ChatView; label: string }[] = [
  { value: "flat", label: "Плоский" },
  { value: "bubbles", label: "Пузыри" },
];

export function AppearanceTab() {
  const { preferences, setPreference } = usePreferences();

  return (
    <div className="settings-tab">
      <h2 className="settings-tab__title">Внешний вид</h2>

      <div className="settings-field">
        <span className="settings-field__label">Тема</span>
        <div className="settings-seg" role="group" aria-label="Тема">
          {THEME_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              className={`settings-seg__btn${preferences.theme === value ? " is-active" : ""}`}
              onClick={() => setPreference("theme", value)}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="settings-field__hint">Системная следует настройкам ОС</span>
      </div>

      <div className="settings-field">
        <span className="settings-field__label">Вид чата по умолчанию</span>
        <div className="settings-seg" role="group" aria-label="Вид чата">
          {VIEW_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              className={`settings-seg__btn${preferences.defaultChatView === value ? " is-active" : ""}`}
              onClick={() => setPreference("defaultChatView", value)}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="settings-field__hint">Применится при следующем открытии чата</span>
      </div>
    </div>
  );
}
