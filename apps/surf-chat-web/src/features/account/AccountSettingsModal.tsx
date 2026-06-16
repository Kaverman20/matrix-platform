import { AnimatePresence, motion } from "framer-motion";
import { Camera, Copy, LogOut, ShieldCheck, X } from "lucide-react";
import { useRef, useState } from "react";
import { colorForId } from "@matrix-platform/matrix-core";
import { transition } from "@matrix-platform/ui";
import type { useAccountSettings } from "./useAccountSettings";
import "./account-settings.css";

type AccountSettings = ReturnType<typeof useAccountSettings>;

type Props = {
  settings: AccountSettings;
  onLogout: () => void;
  onOpenEncryption: () => void;
};

export function AccountSettingsModal({ settings: s, onLogout, onOpenEncryption }: Props) {
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [copied, setCopied] = useState(false);
  const profile = s.profile;

  const copyUserId = async () => {
    if (!profile?.userId) return;
    await navigator.clipboard.writeText(profile.userId);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <AnimatePresence>
      {s.open && profile && (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={s.close}
        >
          <motion.div
            className="spacemodal account-settings"
            role="dialog"
            aria-modal="true"
            aria-label="Профиль"
            onClick={(event) => event.stopPropagation()}
            initial={{ scale: 0.94, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.94, opacity: 0, y: 8 }}
            transition={transition.base}
          >
            <button className="spacemodal__close" onClick={s.close} aria-label="Закрыть">
              <X size={18} />
            </button>

            <div className="spacemodal__heading">Профиль</div>

            <button
              type="button"
              className="spacemodal__avatar"
              onClick={() => avatarInputRef.current?.click()}
              title="Сменить аватар"
            >
              {s.avatarPreview || profile.avatarUrl ? (
                <img className="spacemodal__avatarImg" src={s.avatarPreview ?? profile.avatarUrl} alt="" />
              ) : (
                <span className="account-settings__avatar-fallback" style={{ background: colorForId(profile.userId) }}>
                  {profile.displayName.slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="spacemodal__avatarCam">
                <Camera size={16} />
              </span>
            </button>

            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(event) => {
                s.setAvatar(event.target.files?.[0] ?? null);
                event.target.value = "";
              }}
            />

            <input
              className="spacemodal__name"
              placeholder="Имя"
              value={s.displayName}
              onChange={(event) => s.setDisplayName(event.target.value)}
            />

            <button type="button" className="account-settings__id" onClick={copyUserId}>
              <span>{profile.userId}</span>
              <Copy size={16} />
              <em>{copied ? "Скопировано" : "Копировать"}</em>
            </button>

            {s.error && <p className="spacemodal__hint">{s.error}</p>}

            <button
              type="button"
              className="account-settings__id"
              onClick={() => {
                s.close();
                onOpenEncryption();
              }}
            >
              <span>Шифрование</span>
              <ShieldCheck size={16} />
              <em>Настроить</em>
            </button>

            <div className="account-settings__actions">
              <button
                type="button"
                className="spacemodal__create"
                onClick={() => void s.save()}
                disabled={!s.displayName.trim() || s.pending}
              >
                {s.pending ? "Сохраняем..." : "Сохранить"}
              </button>
              <button
                type="button"
                className="account-settings__logout"
                onClick={() => {
                  s.close();
                  onLogout();
                }}
              >
                <LogOut size={17} />
                <span>Выйти</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
