import { AnimatePresence, motion } from "framer-motion";
import { Boxes, Camera, Hash, X } from "lucide-react";
import { useRef } from "react";
import { transition } from "@matrix-platform/ui";
import { AuthedImage } from "../../components/AuthedImage";
import type { RoomSettings } from "./useRoomSettings";
import "./room-settings.css";

type Props = {
  settings: RoomSettings;
  onLeaveRoom?: () => void;
};

export function RoomSettingsModal({ settings: s, onLeaveRoom }: Props) {
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const heading = s.isSpace ? "Настройки пространства" : "Настройки канала";

  return (
    <AnimatePresence>
      {s.open && (
        <motion.div
          className="surf-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={s.close}
        >
          <motion.div
            className="surf-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={heading}
            onClick={(event) => event.stopPropagation()}
            initial={{ scale: 0.94, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.94, opacity: 0, y: 8 }}
            transition={transition.base}
          >
            <button className="surf-dialog__close" onClick={s.close} aria-label="Закрыть">
              <X size={18} />
            </button>

            <div className="surf-dialog__title">{heading}</div>

            <button
              type="button"
              className="surf-dialog__avatar"
              onClick={() => s.canManage && avatarInputRef.current?.click()}
              title={s.canManage ? "Сменить картинку" : undefined}
              disabled={!s.canManage}
            >
              {s.avatarPreview ? (
                <img className="surf-dialog__avatarImg" src={s.avatarPreview} alt="" />
              ) : (
                <>
                  {s.isSpace ? <Boxes size={34} /> : <Hash size={34} />}
                  {s.currentAvatarUrl && (
                    <AuthedImage url={s.currentAvatarUrl} className="surf-dialog__avatarImg" />
                  )}
                </>
              )}
              {s.canManage && (
                <span className="surf-dialog__avatarCam">
                  <Camera size={16} />
                </span>
              )}
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
              className="surf-input surf-input--underline"
              placeholder="Название"
              value={s.name}
              disabled={!s.canManage}
              onChange={(event) => s.setName(event.target.value)}
            />

            <textarea
              className="room-settings__topic"
              placeholder="Описание (необязательно)"
              rows={3}
              value={s.topic}
              disabled={!s.canManage}
              onChange={(event) => s.setTopic(event.target.value)}
            />

            {!s.canManage && (
              <p className="surf-hint">Недостаточно прав для изменения настроек.</p>
            )}

            <button
              className="surf-btn surf-btn--primary surf-btn--block"
              onClick={() => void s.save()}
              disabled={!s.canManage || !s.name.trim() || s.pending}
            >
              {s.pending ? "Сохраняем..." : "Сохранить"}
            </button>

            {onLeaveRoom && (
              <button
                type="button"
                className="room-settings__leave"
                onClick={onLeaveRoom}
              >
                {s.isSpace ? "Покинуть пространство" : "Покинуть канал"}
              </button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
