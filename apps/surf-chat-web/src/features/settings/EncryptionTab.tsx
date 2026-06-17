import { Check, Copy, Loader2 } from "lucide-react";
import { useState } from "react";
import type { useEncryption } from "../encryption/useEncryption";
import "../encryption/encryption.css";

type Props = {
  encryption: ReturnType<typeof useEncryption>;
};

export function EncryptionTab({ encryption: e }: Props) {
  const [copied, setCopied] = useState(false);

  const copyKey = async () => {
    if (!e.recoveryKey) return;
    await navigator.clipboard.writeText(e.recoveryKey);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const status = e.status;
  const encryptionOn = status?.cryptoEnabled ?? false;
  const deviceVerified = (status?.crossSigningReady && status?.secretStorageReady) ?? false;
  const hasBackup = status?.keyBackupVersion != null;

  return (
    <div className="settings-tab">
      <h2 className="settings-tab__title">Шифрование</h2>

      <div className="settings-status">
        <div className="settings-status__row">
          <span>Сквозное шифрование</span>
          <strong className={encryptionOn ? "settings-status__on" : "settings-status__off"}>
            {encryptionOn ? "включено" : "выключено"}
          </strong>
        </div>
        <div className="settings-status__row">
          <span>Резервная копия ключей</span>
          <strong className={hasBackup ? "settings-status__on" : "settings-status__off"}>
            {hasBackup ? `версия ${status?.keyBackupVersion}` : "нет"}
          </strong>
        </div>
        <div className="settings-status__row">
          <span>Это устройство</span>
          <strong className={deviceVerified ? "settings-status__on" : "settings-status__off"}>
            {deviceVerified ? "подтверждено" : "не подтверждено"}
          </strong>
        </div>
      </div>

      {(e.phase === "loading" || e.phase === "working") && (
        <p className="encryption__text encryption__text--muted">
          <Loader2 className="encryption__spin" size={16} />{" "}
          {e.phase === "working" ? "Включаем шифрование…" : "Проверяем состояние…"}
        </p>
      )}

      {e.phase === "ready" && (
        <p className="encryption__text">
          Сквозное шифрование включено, это устройство подтверждено. Сообщения в
          зашифрованных комнатах будут расшифровываться автоматически.
        </p>
      )}

      {e.phase === "needs-setup" && (
        <>
          <p className="encryption__text">
            Сейчас будет создан ключ восстановления — он понадобится для доступа к
            зашифрованной переписке на других устройствах. Ключ генерируется
            автоматически, его нужно будет только сохранить.
          </p>
          <button
            type="button"
            className="surf-btn surf-btn--primary"
            disabled={e.busy}
            onClick={() => void e.startSetup()}
          >
            {e.busy ? "Создаём ключ…" : "Включить шифрование"}
          </button>
        </>
      )}

      {e.phase === "show-key" && e.recoveryKey && (
        <>
          <p className="encryption__text">
            Сохраните этот ключ восстановления в надёжном месте. Без него доступ к
            истории на новом устройстве не вернуть.
          </p>
          <button type="button" className="encryption__key" onClick={() => void copyKey()}>
            <code>{e.recoveryKey}</code>
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
          <button
            type="button"
            className="surf-btn surf-btn--primary"
            disabled={e.busy}
            onClick={() => void e.confirmKeySaved()}
          >
            Я сохранил ключ
          </button>
        </>
      )}

      {e.phase === "password" && (
        <>
          <p className="encryption__text">
            Последний шаг: подтвердите паролем аккаунта, чтобы сервер принял ключи
            шифрования.
          </p>
          <input
            className="encryption__input surf-input surf-input--mono"
            type="password"
            placeholder="Пароль аккаунта"
            autoComplete="current-password"
            value={e.password}
            onChange={(event) => e.setPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") e.submitPassword();
            }}
          />
          <button
            type="button"
            className="surf-btn surf-btn--primary"
            disabled={!e.password || e.busy}
            onClick={e.submitPassword}
          >
            Подтвердить
          </button>
        </>
      )}

      {e.phase === "needs-unlock" && (
        <>
          <p className="encryption__text">
            Введите ключ восстановления, чтобы подтвердить это устройство и
            восстановить историю зашифрованных комнат.
          </p>
          <input
            className="encryption__input surf-input surf-input--mono encryption__input--key"
            type="text"
            placeholder="Ключ восстановления"
            autoComplete="off"
            spellCheck={false}
            value={e.keyInput}
            onChange={(event) => e.setKeyInput(event.target.value)}
          />
          <button
            type="button"
            className="surf-btn surf-btn--primary"
            disabled={!e.keyInput.trim() || e.busy}
            onClick={() => void e.runUnlock()}
          >
            {e.busy ? "Проверяем…" : "Подтвердить устройство"}
          </button>
        </>
      )}

      {e.phase === "error" && (
        <p className="encryption__text encryption__text--muted">
          Не удалось загрузить состояние шифрования.
        </p>
      )}

      {e.error && <p className="surf-hint surf-hint--error">{e.error}</p>}
    </div>
  );
}
