import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, Loader2, Lock, ShieldCheck, X } from "lucide-react";
import { useState } from "react";
import { transition } from "@matrix-platform/ui";
import type { useEncryption } from "./useEncryption";
import "./encryption.css";

type Props = {
  encryption: ReturnType<typeof useEncryption>;
};

export function EncryptionModal({ encryption: e }: Props) {
  const [copied, setCopied] = useState(false);

  const copyKey = async () => {
    if (!e.recoveryKey) return;
    await navigator.clipboard.writeText(e.recoveryKey);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <AnimatePresence>
      {e.open && (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={e.close}
        >
          <motion.div
            className="spacemodal encryption"
            role="dialog"
            aria-modal="true"
            aria-label="Шифрование"
            onClick={(event) => event.stopPropagation()}
            initial={{ scale: 0.94, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.94, opacity: 0, y: 8 }}
            transition={transition.base}
          >
            <button className="spacemodal__close" onClick={e.close} aria-label="Закрыть">
              <X size={18} />
            </button>

            <div className="encryption__icon">
              {e.phase === "ready" ? <ShieldCheck size={26} /> : <Lock size={26} />}
            </div>
            <div className="spacemodal__heading">Шифрование</div>

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
                  className="spacemodal__create"
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
                  className="spacemodal__create"
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
                  className="encryption__input"
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
                  className="spacemodal__create"
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
                  className="encryption__input encryption__input--key"
                  type="text"
                  placeholder="Ключ восстановления"
                  autoComplete="off"
                  spellCheck={false}
                  value={e.keyInput}
                  onChange={(event) => e.setKeyInput(event.target.value)}
                />
                <button
                  type="button"
                  className="spacemodal__create"
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

            {e.error && <p className="spacemodal__hint encryption__error">{e.error}</p>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
