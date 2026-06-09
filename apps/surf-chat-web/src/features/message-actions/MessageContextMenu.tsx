import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ChevronRight, Copy, Forward, Pencil, Pin, Reply, Trash2 } from "lucide-react";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import type { MatrixMessage } from "@matrix-platform/matrix-core";
import { transition } from "@matrix-platform/ui";
import "./message-context-menu.css";

export type MessageAction = "reply" | "edit" | "copy" | "forward" | "pin" | "delete";
const QUICK_REACTIONS = ["👍", "❤️", "😂", "🔥", "👏", "🤔", "👎"];

type Props = {
  canPin: boolean;
  message: MatrixMessage;
  x: number;
  y: number;
  onClose: () => void;
  onAction: (action: MessageAction, message: MatrixMessage) => void;
  onReact: (message: MatrixMessage, key: string) => void;
};

const MENU_PICKER_WIDTH = 352;
const MENU_HEIGHT = 288;
const MENU_PICKER_HEIGHT = 470;
const SAFE_OFFSET = 12;

export function MessageContextMenu({ canPin, message, x, y, onAction, onClose, onReact }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const left = clamp(x, SAFE_OFFSET, window.innerWidth - MENU_PICKER_WIDTH - SAFE_OFFSET);
  const top = clamp(y, SAFE_OFFSET, window.innerHeight - MENU_HEIGHT - SAFE_OFFSET);
  const pickerOverflow = pickerOpen
    ? Math.max(0, top + MENU_PICKER_HEIGHT + SAFE_OFFSET - window.innerHeight)
    : 0;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (pickerOpen) setPickerOpen(false);
      else onClose();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [onClose, pickerOpen]);

  const runAction = (action: MessageAction) => {
    onAction(action, message);
    onClose();
  };

  return (
    <motion.div
      ref={ref}
      className="message-menu"
      style={{ left, top }}
      role="menu"
      aria-label="Действия с сообщением"
      initial={{ opacity: 0, scale: 0.96, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: -pickerOverflow }}
      exit={{ opacity: 0, scale: 0.96, y: -pickerOverflow - 4 }}
      transition={transition.fast}
      layout
      onContextMenu={(event) => event.preventDefault()}
    >
      <motion.div className="message-menu__quick" aria-label="Быстрые реакции" layout>
        {pickerOpen ? (
          <button
            type="button"
            className="message-menu__quick-btn message-menu__quick-back"
            onClick={() => setPickerOpen(false)}
            aria-label="Назад к быстрым реакциям"
          >
            <ArrowLeft size={18} />
          </button>
        ) : (
          <>
            {QUICK_REACTIONS.map((key) => (
              <button
                key={key}
                type="button"
                className="message-menu__quick-btn"
                onClick={() => {
                  onReact(message, key);
                  onClose();
                }}
                aria-label={`Реакция ${key}`}
              >
                <span className="message-menu__quick-emoji">{key}</span>
              </button>
            ))}
            <button
              type="button"
              className="message-menu__quick-btn message-menu__quick-more"
              onClick={() => setPickerOpen(true)}
              aria-label="Больше реакций"
            >
              <ChevronRight size={18} />
            </button>
          </>
        )}
      </motion.div>
      <motion.div className="message-menu__body" layout transition={transition.base}>
        <AnimatePresence mode="wait" initial={false}>
          {pickerOpen ? (
            <motion.div
              key="picker"
              className="message-menu__picker"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={transition.fast}
            >
              <Picker
                data={data}
                onEmojiSelect={(event: { native: string }) => {
                  onReact(message, event.native);
                  onClose();
                }}
                theme="light"
                locale="ru"
                navPosition="bottom"
                previewPosition="none"
                skinTonePosition="none"
                maxFrequentRows={2}
              />
            </motion.div>
          ) : (
            <motion.ul
              key="actions"
              className="message-menu__list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={transition.fast}
            >
              <li>
                <button type="button" role="menuitem" className="message-menu__action" onClick={() => runAction("reply")}>
                  <Reply size={17} />
                  <span>Ответить</span>
                </button>
              </li>
              {message.own && (
                <li>
                  <button type="button" role="menuitem" className="message-menu__action" onClick={() => runAction("edit")}>
                    <Pencil size={16} />
                    <span>Изменить</span>
                  </button>
                </li>
              )}
              <li>
                <button type="button" role="menuitem" className="message-menu__action" onClick={() => runAction("copy")}>
                  <Copy size={16} />
                  <span>Копировать текст</span>
                </button>
              </li>
              <li>
                <button type="button" role="menuitem" className="message-menu__action" onClick={() => runAction("forward")}>
                  <Forward size={17} />
                  <span>Переслать</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  role="menuitem"
                  className="message-menu__action"
                  onClick={() => canPin && runAction("pin")}
                  disabled={!canPin}
                  title={canPin ? undefined : "Недостаточно прав для закрепления в этой комнате"}
                >
                  <Pin size={16} />
                  <span>{message.pinned ? "Открепить" : "Закрепить"}</span>
                </button>
              </li>
              {message.own && (
                <li>
                  <button
                    type="button"
                    role="menuitem"
                    className="message-menu__action message-menu__action--danger"
                    onClick={() => runAction("delete")}
                  >
                    <Trash2 size={16} />
                    <span>Удалить</span>
                  </button>
                </li>
              )}
            </motion.ul>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
