import { AnimatePresence, motion } from "framer-motion";
import { Boxes, Camera, Globe, Hash, Lock, Search, UserPlus, X } from "lucide-react";
import { useRef } from "react";
import { colorForId } from "@matrix-platform/matrix-core";
import { transition } from "@matrix-platform/ui";
import type { RoomCreation } from "./useRoomCreation";

type Props = {
  creation: RoomCreation;
  activeSpaceId: string | null;
  activeSpaceName: string | null;
};

export function CreateModals({ creation, activeSpaceId, activeSpaceName }: Props) {
  const c = creation;
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <>
      <AnimatePresence>
        {c.creatingChannel && (
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={c.closeCreateChannel}
          >
            <motion.div
              className="spacemodal"
              role="dialog"
              aria-modal="true"
              aria-label="Создать канал"
              onClick={(event) => event.stopPropagation()}
              initial={{ scale: 0.94, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 8 }}
              transition={transition.base}
            >
              <button className="spacemodal__close" onClick={c.closeCreateChannel} aria-label="Закрыть">
                <X size={18} />
              </button>

              <div className="spacemodal__heading">Новый канал</div>

              <div
                className="spacemodal__avatar spacemodal__avatar--static"
                style={{ background: colorForId(c.newChannelName || activeSpaceId || "channel") }}
              >
                {c.newChannelName.trim() ? c.newChannelName.trim()[0].toUpperCase() : <Hash size={34} />}
              </div>

              <input
                autoFocus
                className="spacemodal__name"
                placeholder="Название канала"
                value={c.newChannelName}
                onChange={(event) => c.setNewChannelName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && c.newChannelName.trim()) {
                    void c.createChannel();
                  }
                }}
              />

              <div className="spacemodal__toggle">
                <button
                  type="button"
                  className={c.newChannelType === "private" ? "is-active" : ""}
                  onClick={() => c.setNewChannelType("private")}
                >
                  {c.newChannelType === "private" && (
                    <motion.span className="seg-pill" layoutId="channel-seg" transition={transition.base} />
                  )}
                  <span className="seg-label"><Lock size={15} /> Приватный</span>
                </button>
                <button
                  type="button"
                  className={c.newChannelType === "public" ? "is-active" : ""}
                  onClick={() => c.setNewChannelType("public")}
                >
                  {c.newChannelType === "public" && (
                    <motion.span className="seg-pill" layoutId="channel-seg" transition={transition.base} />
                  )}
                  <span className="seg-label"><Globe size={15} /> Публичный</span>
                </button>
              </div>

              <p className="spacemodal__hint">
                {activeSpaceId
                  ? `Канал будет создан внутри пространства ${activeSpaceName ?? "без названия"}.`
                  : "Канал появится в общем списке чатов."}{" "}
                {c.newChannelType === "private"
                  ? "Для приватного канала доступ будет ограничен."
                  : "Для публичного канала можно открыть общий доступ."}
              </p>

              <button
                className="spacemodal__create"
                onClick={() => void c.createChannel()}
                disabled={!c.newChannelName.trim() || c.creatingChannelPending}
              >
                {c.creatingChannelPending ? "Создаём..." : "Создать канал"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {c.creatingDm && (
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={c.closeCreateDm}
          >
            <motion.div
              className="spacemodal"
              role="dialog"
              aria-modal="true"
              aria-label="Создать личный чат"
              onClick={(event) => event.stopPropagation()}
              initial={{ scale: 0.94, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 8 }}
              transition={transition.base}
            >
              <button className="spacemodal__close" onClick={c.closeCreateDm} aria-label="Закрыть">
                <X size={18} />
              </button>

              <div className="spacemodal__heading">Новый личный чат</div>

              <div
                className="spacemodal__avatar spacemodal__avatar--static"
                style={{ background: colorForId(c.selectedDmUserId || c.dmQuery || "dm") }}
              >
                <UserPlus size={32} />
              </div>

              <label className="spacemodal__search">
                <Search size={16} />
                <input
                  autoFocus
                  className="spacemodal__searchInput"
                  placeholder="Имя или Matrix ID"
                  value={c.dmQuery}
                  onChange={(event) => c.onDmQueryChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && c.selectedDmUserId) {
                      event.preventDefault();
                      void c.createDirectChat();
                    }
                  }}
                />
              </label>

              <div className="spacemodal__userlist">
                {c.dmQuery.trim().length < 2 ? (
                  <div className="spacemodal__empty">Введите хотя бы 2 символа, чтобы найти пользователя.</div>
                ) : c.dmSearching ? (
                  <div className="spacemodal__empty">Ищем пользователей...</div>
                ) : c.dmResults.length > 0 ? (
                  c.dmResults.map((entry) => {
                    const active = entry.user_id === c.selectedDmUserId;
                    return (
                      <button
                        key={entry.user_id}
                        type="button"
                        className={`spacemodal__user${active ? " is-active" : ""}`}
                        onClick={() => c.setSelectedDmUserId(entry.user_id)}
                      >
                        <span
                          className="spacemodal__userAvatar"
                          style={{ background: colorForId(entry.user_id) }}
                        >
                          {(entry.display_name || entry.user_id)[0]?.toUpperCase() ?? "?"}
                        </span>
                        <span className="spacemodal__userBody">
                          <strong>{entry.display_name || entry.user_id}</strong>
                          {entry.display_name && <span>{entry.user_id}</span>}
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <div className="spacemodal__empty">Никого не нашли.</div>
                )}
              </div>

              <p className="spacemodal__hint">
                Если личный чат с этим пользователем уже есть, мы просто откроем существующий.
              </p>

              <button
                className="spacemodal__create"
                onClick={() => void c.createDirectChat()}
                disabled={!c.selectedDmUserId || c.creatingDmPending}
              >
                {c.creatingDmPending ? "Создаём..." : "Создать личный чат"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {c.creatingSpace && (
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={c.closeCreateSpace}
          >
            <motion.div
              className="spacemodal"
              role="dialog"
              aria-modal="true"
              aria-label="Создать пространство"
              onClick={(event) => event.stopPropagation()}
              initial={{ scale: 0.94, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 8 }}
              transition={transition.base}
            >
              <button className="spacemodal__close" onClick={c.closeCreateSpace} aria-label="Закрыть">
                <X size={18} />
              </button>

              <div className="spacemodal__heading">Новое пространство</div>

              <button
                type="button"
                className="spacemodal__avatar"
                style={c.spaceAvatarPreview ? undefined : { background: colorForId(c.newSpaceName || "space") }}
                onClick={() => avatarInputRef.current?.click()}
                title="Загрузить картинку"
              >
                {c.spaceAvatarPreview ? (
                  <img className="spacemodal__avatarImg" src={c.spaceAvatarPreview} alt="" />
                ) : c.newSpaceName.trim() ? (
                  c.newSpaceName.trim()[0].toUpperCase()
                ) : (
                  <Boxes size={34} />
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
                  c.setSpaceAvatar(event.target.files?.[0] ?? null);
                  event.target.value = "";
                }}
              />

              <input
                autoFocus
                className="spacemodal__name"
                placeholder="Название пространства"
                value={c.newSpaceName}
                onChange={(event) => c.setNewSpaceName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && c.newSpaceName.trim()) {
                    void c.createSpace();
                  }
                }}
              />

              <div className="spacemodal__toggle">
                <button
                  type="button"
                  className={c.newSpaceType === "private" ? "is-active" : ""}
                  onClick={() => c.setNewSpaceType("private")}
                >
                  {c.newSpaceType === "private" && (
                    <motion.span className="seg-pill" layoutId="space-seg" transition={transition.base} />
                  )}
                  <span className="seg-label"><Lock size={15} /> Приватное</span>
                </button>
                <button
                  type="button"
                  className={c.newSpaceType === "public" ? "is-active" : ""}
                  onClick={() => c.setNewSpaceType("public")}
                >
                  {c.newSpaceType === "public" && (
                    <motion.span className="seg-pill" layoutId="space-seg" transition={transition.base} />
                  )}
                  <span className="seg-label"><Globe size={15} /> Публичное</span>
                </button>
              </div>

              <p className="spacemodal__hint">
                {c.newSpaceType === "private"
                  ? "Доступ по группе или приглашению."
                  : "Войти может любой сотрудник."}{" "}
                Внутри создастся канал #general.
              </p>

              <button
                className="spacemodal__create"
                onClick={() => void c.createSpace()}
                disabled={!c.newSpaceName.trim() || c.creatingSpacePending}
              >
                {c.creatingSpacePending ? "Создаём..." : "Создать пространство"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
