import { ChevronLeft, Key, LogOut, Palette, ShieldCheck, SlidersHorizontal, User } from "lucide-react";
import { useEffect, useState } from "react";
import type { useAccountSettings } from "../account/useAccountSettings";
import type { useEncryption } from "../encryption/useEncryption";
import { useMatrix } from "../../app/providers/MatrixContext";
import { useAccessAdmin } from "../access/useAccessAdmin";
import { AccessTab } from "../access/AccessTab";
import { AccountTab } from "./AccountTab";
import { AppearanceTab } from "./AppearanceTab";
import { EncryptionTab } from "./EncryptionTab";
import { PreferencesTab } from "./PreferencesTab";
import "./settings.css";

type TabId = "account" | "appearance" | "preferences" | "encryption" | "access";

const BASE_TABS: { id: TabId; label: string; icon: typeof User }[] = [
  { id: "account", label: "Аккаунт", icon: User },
  { id: "appearance", label: "Внешний вид", icon: Palette },
  { id: "preferences", label: "Настройки", icon: SlidersHorizontal },
  { id: "encryption", label: "Шифрование", icon: ShieldCheck },
];

const ACCESS_TAB = { id: "access" as const, label: "Доступы", icon: Key };

type Props = {
  settings: ReturnType<typeof useAccountSettings>;
  encryption: ReturnType<typeof useEncryption>;
  onLogout: () => void;
};

/** Full-screen settings (Linear Preferences) — replaces the chat shell entirely. */
export function SettingsPage({ settings: s, encryption, onLogout }: Props) {
  const [tab, setTab] = useState<TabId>("account");
  const { client } = useMatrix();
  const { isAdmin } = useAccessAdmin(client);
  const tabs = isAdmin ? [...BASE_TABS, ACCESS_TAB] : BASE_TABS;

  useEffect(() => {
    void encryption.refresh();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") s.close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="settings-page" role="application" aria-label="Настройки">
      <aside className="settings-page__nav">
        <button type="button" className="settings-page__back" onClick={s.close}>
          <ChevronLeft size={18} />
          <span>Назад в чат</span>
        </button>

        <nav className="settings-page__tabs" aria-label="Разделы настроек">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={`settings-page__tab${tab === id ? " is-active" : ""}`}
              onClick={() => setTab(id)}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <button
          type="button"
          className="settings-page__logout"
          onClick={() => {
            s.close();
            onLogout();
          }}
        >
          <LogOut size={18} />
          <span>Выйти</span>
        </button>
      </aside>

      <main className="settings-page__main">
        <div className="settings-page__content">
          {tab === "account" && <AccountTab settings={s} />}
          {tab === "appearance" && <AppearanceTab />}
          {tab === "preferences" && <PreferencesTab />}
          {tab === "encryption" && <EncryptionTab encryption={encryption} />}
          {tab === "access" && <AccessTab />}
        </div>
      </main>
    </div>
  );
}
