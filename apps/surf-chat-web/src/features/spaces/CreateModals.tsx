import { AnimatePresence, motion } from "framer-motion";
import { Boxes, Camera, ChevronLeft, ChevronRight, Globe, Hash, Lock, Search, UserPlus, X } from "lucide-react";
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
  const isSub = c.channelKind === "space";

  return (
    <>
      <AnimatePresence>
        {c.creatingChannel && (
          <motion.div
            className="surf-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={c.closeCreateChannel}
          >
            <motion.div
              className="surf-dialog"
              role="dialog"
              aria-modal="true"
              aria-label={isSub ? "Создать сабспейс" : "Создать канал"}
              onClick={(event) => event.stopPropagation()}
              initial={{ scale: 0.94, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 8 }}
              transition={transition.base}
            >
              <button className="surf-dialog__close" onClick={c.closeCreateChannel} aria-label="Закрыть">
                <X size={18} />
              </button>

              <div className="surf-dialog__title">{isSub ? "Новый сабспейс" : "Новый канал"}</div>

              <div
                className="surf-dialog__avatar surf-dialog__avatar--static"
                style={{ background: colorForId(c.newChannelName || activeSpaceId || "channel") }}
              >
                {c.newChannelName.trim() ? c.newChannelName.trim()[0].toUpperCase() : isSub ? <Boxes size={34} /> : <Hash size={34} />}
              </div>

              <input
                autoFocus
                className="surf-input surf-input--underline"
                placeholder={isSub ? "Название сабспейса" : "Название канала"}
                value={c.newChannelName}
                onChange={(event) => c.setNewChannelName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && c.newChannelName.trim()) {
                    void c.createChannel();
                  }
                }}
              />

              <div className="surf-seg">
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

              <p className="surf-hint">
                {isSub
                  ? `Сабспейс появится внутри пространства ${activeSpaceName ?? "без названия"}.`
                  : activeSpaceId
                    ? `Канал будет создан внутри пространства ${activeSpaceName ?? "без названия"}.`
                    : "Канал появится в общем списке чатов."}{" "}
                {c.newChannelType === "private"
                  ? "Доступ будет ограничен."
                  : "Можно открыть общий доступ."}
              </p>

              <button
                className="surf-btn surf-btn--primary surf-btn--block"
                onClick={() => void c.createChannel()}
                disabled={!c.newChannelName.trim() || c.creatingChannelPending}
              >
                {c.creatingChannelPending ? "Создаём..." : isSub ? "Создать сабспейс" : "Создать канал"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {c.creatingDm && (
          <motion.div
            className="surf-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={c.closeCreateDm}
          >
            <motion.div
              className="surf-dialog"
              role="dialog"
              aria-modal="true"
              aria-label="Создать личный чат"
              onClick={(event) => event.stopPropagation()}
              initial={{ scale: 0.94, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 8 }}
              transition={transition.base}
            >
              <button className="surf-dialog__close" onClick={c.closeCreateDm} aria-label="Закрыть">
                <X size={18} />
              </button>

              <div className="surf-dialog__title">Новый личный чат</div>

              <div
                className="surf-dialog__avatar surf-dialog__avatar--static"
                style={{ background: colorForId(c.selectedDmUserId || c.dmQuery || "dm") }}
              >
                <UserPlus size={32} />
              </div>

              <label className="surf-dialog__search">
                <Search size={16} />
                <input
                  autoFocus
                  className="surf-dialog__searchInput"
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

              <div className="surf-dialog__userlist">
                {c.dmQuery.trim().length < 2 ? (
                  <div className="surf-dialog__empty">Введите хотя бы 2 символа, чтобы найти пользователя.</div>
                ) : c.dmSearching ? (
                  <div className="surf-dialog__empty">Ищем пользователей...</div>
                ) : c.dmResults.length > 0 ? (
                  c.dmResults.map((entry) => {
                    const active = entry.user_id === c.selectedDmUserId;
                    return (
                      <button
                        key={entry.user_id}
                        type="button"
                        className={`surf-dialog__user${active ? " is-active" : ""}`}
                        onClick={() => c.setSelectedDmUserId(entry.user_id)}
                      >
                        <span
                          className="surf-dialog__userAvatar"
                          style={{ background: colorForId(entry.user_id) }}
                        >
                          {(entry.display_name || entry.user_id)[0]?.toUpperCase() ?? "?"}
                        </span>
                        <span className="surf-dialog__userBody">
                          <strong>{entry.display_name || entry.user_id}</strong>
                          {entry.display_name && <span>{entry.user_id}</span>}
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <div className="surf-dialog__empty">Никого не нашли.</div>
                )}
              </div>

              <p className="surf-hint">
                Если личный чат с этим пользователем уже есть, мы просто откроем существующий.
              </p>

              <button
                className="surf-btn surf-btn--primary surf-btn--block"
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
            className="surf-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={c.closeCreateSpace}
          >
            <motion.div
              className="surf-dialog"
              role="dialog"
              aria-modal="true"
              aria-label="Создать пространство"
              onClick={(event) => event.stopPropagation()}
              initial={{ scale: 0.94, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 8 }}
              transition={transition.base}
            >
              <button className="surf-dialog__close" onClick={c.closeCreateSpace} aria-label="Закрыть">
                <X size={18} />
              </button>

              {c.spaceStep === "form" ? (
                <>
                  <div className="surf-dialog__title">Новое пространство</div>

                  <button
                    type="button"
                    className="surf-dialog__avatar"
                    style={c.spaceAvatarPreview ? undefined : { background: colorForId(c.newSpaceName || "space") }}
                    onClick={() => avatarInputRef.current?.click()}
                    title="Загрузить картинку"
                  >
                    {c.spaceAvatarPreview ? (
                      <img className="surf-dialog__avatarImg" src={c.spaceAvatarPreview} alt="" />
                    ) : c.newSpaceName.trim() ? (
                      c.newSpaceName.trim()[0].toUpperCase()
                    ) : (
                      <Boxes size={34} />
                    )}
                    <span className="surf-dialog__avatarCam">
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
                    className="surf-input surf-input--underline"
                    placeholder="Название пространства"
                    value={c.newSpaceName}
                    onChange={(event) => c.setNewSpaceName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && c.newSpaceName.trim()) {
                        void c.createSpace();
                      }
                    }}
                  />

                  <div className="surf-seg">
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

                  <p className="surf-hint">
                    {c.newSpaceType === "private"
                      ? "Доступ по группе или приглашению."
                      : "Войти может любой сотрудник."}{" "}
                    Дальше добавите каналы.
                  </p>

                  <button
                    className="surf-btn surf-btn--primary surf-btn--block"
                    onClick={() => void c.createSpace()}
                    disabled={!c.newSpaceName.trim() || c.creatingSpacePending}
                  >
                    {c.creatingSpacePending ? "Создаём..." : "Создать пространство"}
                  </button>
                </>
              ) : (
                <>
                  {c.wizardParentName && (
                    <button type="button" className="surf-dialog__back" onClick={c.wizardBack}>
                      <ChevronLeft size={16} /> {c.wizardParentName}
                    </button>
                  )}

                  <div className="surf-dialog__title">Наполните «{c.wizardCurrentName}»</div>

                  <p className="surf-hint">
                    Добавьте каналы и сабспейсы. Можно несколько — или пропустить и добавить позже.
                  </p>

                  <input
                    autoFocus
                    className="surf-input surf-input--underline"
                    placeholder="Название канала или сабспейса"
                    value={c.wizardName}
                    onChange={(event) => c.setWizardName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && c.wizardName.trim()) {
                        void c.addWizardChannel();
                      }
                    }}
                  />

                  <div className="surf-seg">
                    <button
                      type="button"
                      className={c.wizardType === "private" ? "is-active" : ""}
                      onClick={() => c.setWizardType("private")}
                    >
                      {c.wizardType === "private" && (
                        <motion.span className="seg-pill" layoutId="wizard-seg" transition={transition.base} />
                      )}
                      <span className="seg-label"><Lock size={15} /> Приватное</span>
                    </button>
                    <button
                      type="button"
                      className={c.wizardType === "public" ? "is-active" : ""}
                      onClick={() => c.setWizardType("public")}
                    >
                      {c.wizardType === "public" && (
                        <motion.span className="seg-pill" layoutId="wizard-seg" transition={transition.base} />
                      )}
                      <span className="seg-label"><Globe size={15} /> Публичное</span>
                    </button>
                  </div>

                  <div className="surf-dialog__addRow">
                    <button
                      className="surf-dialog__add"
                      onClick={() => void c.addWizardChannel()}
                      disabled={!c.wizardName.trim() || c.wizardPending}
                    >
                      <Hash size={15} /> Канал
                    </button>
                    <button
                      className="surf-dialog__add"
                      onClick={() => void c.addWizardSubspace()}
                      disabled={!c.wizardName.trim() || c.wizardPending}
                    >
                      <Boxes size={15} /> Сабспейс
                    </button>
                  </div>

                  {c.wizardChildren.length > 0 && (
                    <div className="surf-dialog__chips">
                      {c.wizardChildren.map((item) =>
                        item.kind === "space" ? (
                          <button
                            key={item.id}
                            type="button"
                            className="surf-dialog__chip surf-dialog__chip--btn"
                            onClick={() => c.enterWizardItem(item)}
                            title="Открыть и добавить каналы внутрь"
                          >
                            <Boxes size={13} />
                            {item.name}
                            <ChevronRight size={13} />
                          </button>
                        ) : (
                          <span key={item.id} className="surf-dialog__chip">
                            <Hash size={13} />
                            {item.name}
                          </span>
                        ),
                      )}
                    </div>
                  )}

                  <button className="surf-btn surf-btn--primary surf-btn--block" onClick={c.finishSpaceWizard}>
                    {c.wizardItemCount > 0 ? "Готово" : "Пропустить"}
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
