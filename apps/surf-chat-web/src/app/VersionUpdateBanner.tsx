import { AnimatePresence, motion } from "framer-motion";
import { transition } from "@matrix-platform/ui";
import "./version-update-banner.css";

type Props = {
  visible: boolean;
  onReload: () => void;
  onDismiss: () => void;
};

export function VersionUpdateBanner({ visible, onReload, onDismiss }: Props) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="version-banner"
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: 12, x: "-50%" }}
          animate={{ opacity: 1, y: 0, x: "-50%" }}
          exit={{ opacity: 0, y: 12, x: "-50%" }}
          transition={transition.base}
        >
          <div className="version-banner__text">
            <strong>Доступна новая версия</strong>
            <span>Обновите страницу, чтобы получить последние изменения.</span>
          </div>
          <div className="version-banner__actions">
            <button type="button" className="version-banner__btn version-banner__btn--ghost" onClick={onDismiss}>
              Позже
            </button>
            <button type="button" className="version-banner__btn version-banner__btn--primary" onClick={onReload}>
              Обновить
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
