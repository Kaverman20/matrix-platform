import { AnimatePresence, motion } from "framer-motion";
import { Palette, ShieldCheck, SlidersHorizontal, User, X } from "lucide-react";
import { useEffect, useState } from "react";
import { transition } from "@matrix-platform/ui";
import type { useAccountSettings } from "../account/useAccountSettings";
import type { useEncryption } from "../encryption/useEncryption";
import { AccountTab } from "./AccountTab";
import { AppearanceTab } from "./AppearanceTab";
import { EncryptionTab } from "./EncryptionTab";
import { PreferencesTab } from "./PreferencesTab";
import "./settings.css";

type TabId = "account" | "appearance" | "preferences" | "encryption";

const TABS: { id: TabId; label: string; icon: typeof User }[] = [
  { id: "account", label: "Аккаунт", icon: User },
  { id: "appearance", label: "Внешний вид", icon: Palette },
  { id: "preferences", label: "Настройки", icon: SlidersHorizontal },
  { id: "encryption", label: "Шифрование", icon: ShieldCheck },
];

type Props = {
  settings: ReturnType<typeof useAccountSettings>;
  encryption: ReturnType<typeof useEncryption>;
  onLogout: () => void;
};

export function SettingsModal({ settings: s, encryption, onLogout }: Props) {
  return (
    <AnimatePresence>
      {s.open && s.profile && (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={s.close}
        >
          <SettingsDialog settings={s} encryption={encryption} onLogout={onLogout} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Mounted fresh on each open, so the tab selection always starts on "account"
// and the encryption status is re-checked without a reset effect.
function SettingsDialog({ settings: s, encryption, onLogout }: Props) {
  const [tab, setTab] = useState<TabId>("account");

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
    <motion.div
      className="settings-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Настройки"
      onClick={(event) => event.stopPropagation()}
      initial={{ scale: 0.96, opacity: 0, y: 8 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.96, opacity: 0, y: 8 }}
      transition={transition.base}
    >
      <nav className="settings-modal__nav">
        <div className="settings-modal__navTitle">Настройки</div>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={`settings-modal__tab${tab === id ? " settings-modal__tab--active" : ""}`}
            onClick={() => setTab(id)}
          >
            <Icon size={18} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="settings-modal__content">
        <button className="spacemodal__close" onClick={s.close} aria-label="Закрыть">
          <X size={18} />
        </button>
        {tab === "account" && <AccountTab settings={s} onLogout={onLogout} />}
        {tab === "appearance" && <AppearanceTab />}
        {tab === "preferences" && <PreferencesTab />}
        {tab === "encryption" && <EncryptionTab encryption={encryption} />}
      </div>
    </motion.div>
  );
}
