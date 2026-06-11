import { AnimatePresence, motion } from "framer-motion";
import { Boxes, Camera, Hash, X } from "lucide-react";
import { useRef } from "react";
import { transition } from "@matrix-platform/ui";
import { AuthedImage } from "../media/AuthedImage";
import type { RoomSettings } from "./useRoomSettings";
import "./room-settings.css";

type Props = {
  settings: RoomSettings;
};

export function RoomSettingsModal({ settings: s }: Props) {
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const heading = s.isSpace ? "Настройки пространства" : "Настройки канала";

  return (
    <AnimatePresence>
      {s.open && (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={s.close}
        >
          <motion.div
            className="spacemodal"
            role="dialog"
            aria-modal="true"
            aria-label={heading}
            onClick={(event) => event.stopPropagation()}
            initial={{ scale: 0.94, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.94, opacity: 0, y: 8 }}
            transition={transition.base}
          >
            <button className="spacemodal__close" onClick={s.close} aria-label="Закрыть">
              <X size={18} />
            </button>

            <div className="spacemodal__heading">{heading}</div>

            <button
              type="button"
              className="spacemodal__avatar"
              onClick={() => s.canManage && avatarInputRef.current?.click()}
              title={s.canManage ? "Сменить картинку" : undefined}
              disabled={!s.canManage}
            >
              {s.avatarPreview ? (
                <img className="spacemodal__avatarImg" src={s.avatarPreview} alt="" />
              ) : (
                <>
                  {s.isSpace ? <Boxes size={34} /> : <Hash size={34} />}
                  {s.currentAvatarUrl && (
                    <AuthedImage url={s.currentAvatarUrl} className="spacemodal__avatarImg" />
                  )}
                </>
              )}
              {s.canManage && (
                <span className="spacemodal__avatarCam">
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
              className="spacemodal__name"
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
              <p className="spacemodal__hint">Недостаточно прав для изменения настроек.</p>
            )}

            <button
              className="spacemodal__create"
              onClick={() => void s.save()}
              disabled={!s.canManage || !s.name.trim() || s.pending}
            >
              {s.pending ? "Сохраняем..." : "Сохранить"}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
