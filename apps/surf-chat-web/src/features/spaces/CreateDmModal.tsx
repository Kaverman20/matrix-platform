import { AnimatePresence, motion } from "framer-motion";
import { Search, UserPlus, X } from "lucide-react";
import { colorForId } from "@matrix-platform/matrix-core";
import { transition } from "@matrix-platform/ui";
import type { RoomCreation } from "./useRoomCreation";

type Props = {
  creation: RoomCreation;
};

export function CreateDmModal({ creation: c }: Props) {
  return (
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
  );
}
