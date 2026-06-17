import { Camera, Copy, LogOut } from "lucide-react";
import { useRef, useState } from "react";
import { colorForId } from "@matrix-platform/matrix-core";
import type { useAccountSettings } from "../account/useAccountSettings";
import "../account/account-settings.css";

type Props = {
  settings: ReturnType<typeof useAccountSettings>;
  onLogout: () => void;
};

export function AccountTab({ settings: s, onLogout }: Props) {
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [copied, setCopied] = useState(false);
  const profile = s.profile;

  if (!profile) return null;

  const copyUserId = async () => {
    if (!profile.userId) return;
    await navigator.clipboard.writeText(profile.userId);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="settings-tab settings-tab--account">
      <h2 className="settings-tab__title">Аккаунт</h2>

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
    </div>
  );
}
