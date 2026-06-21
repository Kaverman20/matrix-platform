import { AnimatePresence, motion } from "framer-motion";
import { Boxes, Globe, Hash, Lock, X } from "lucide-react";
import { colorForId } from "@matrix-platform/matrix-core";
import { transition } from "@matrix-platform/ui";
import type { RoomCreation } from "./useRoomCreation";

type Props = {
  creation: RoomCreation;
  activeSpaceId: string | null;
  activeSpaceName: string | null;
};

export function CreateChannelModal({ creation: c, activeSpaceId, activeSpaceName }: Props) {
  const isSub = c.channelKind === "space";

  return (
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
  );
}
