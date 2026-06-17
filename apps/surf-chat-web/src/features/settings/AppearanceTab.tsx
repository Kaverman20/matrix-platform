import type { ChatView } from "./usePreferences";
import { usePreferences } from "./usePreferences";
import { SettingsSelect } from "./SettingsSelect";
import { THEME_PRESETS } from "./themePresets";

const VIEW_OPTIONS: { value: ChatView; label: string; hint?: string }[] = [
  { value: "flat", label: "Плоский", hint: "Сообщения в одной колонке" },
  { value: "bubbles", label: "Пузыри", hint: "Пузырьки как в мессенджере" },
];

export function AppearanceTab() {
  const { preferences, setPreference } = usePreferences();

  return (
    <div className="settings-tab">
      <h2 className="settings-tab__title">Внешний вид</h2>

      <div className="settings-list settings-list--rows">
        <div className="settings-row settings-row--control">
          <span className="settings-row__label">Тема интерфейса</span>
          <SettingsSelect
            ariaLabel="Тема интерфейса"
            value={preferences.theme}
            options={THEME_PRESETS}
            onChange={(theme) => setPreference("theme", theme)}
          />
        </div>

        <div className="settings-row settings-row--control">
          <span className="settings-row__label">Вид чата по умолчанию</span>
          <SettingsSelect
            ariaLabel="Вид чата по умолчанию"
            value={preferences.defaultChatView}
            options={VIEW_OPTIONS}
            onChange={(view) => setPreference("defaultChatView", view)}
          />
        </div>
      </div>

      <p className="settings-tab__footnote">
        Системная тема следует настройкам ОС. Вид чата применится при следующем открытии чата.
      </p>
    </div>
  );
}
