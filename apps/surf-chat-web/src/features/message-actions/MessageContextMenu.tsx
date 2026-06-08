import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Copy, Forward, Pencil, Reply, Trash2 } from "lucide-react";
import type { MatrixMessage } from "@matrix-platform/matrix-core";
import { transition } from "@matrix-platform/ui";
import "./message-context-menu.css";

export type MessageAction = "reply" | "edit" | "copy" | "forward" | "delete";
const QUICK_REACTIONS = ["👍", "❤️", "😂", "🔥", "👏", "🤔", "👎"];

type Props = {
  message: MatrixMessage;
  x: number;
  y: number;
  onClose: () => void;
  onAction: (action: MessageAction, message: MatrixMessage) => void;
  onReact: (message: MatrixMessage, key: string) => void;
};

const MENU_WIDTH = 236;
const MENU_HEIGHT = 288;
const SAFE_OFFSET = 12;

export function MessageContextMenu({ message, x, y, onAction, onClose, onReact }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const left = clamp(x, SAFE_OFFSET, window.innerWidth - MENU_WIDTH - SAFE_OFFSET);
  const top = clamp(y, SAFE_OFFSET, window.innerHeight - MENU_HEIGHT - SAFE_OFFSET);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
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
  }, [onClose]);

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
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: -4 }}
      transition={transition.fast}
      layout
      onContextMenu={(event) => event.preventDefault()}
    >
      <motion.div className="message-menu__quick" aria-label="Быстрые реакции" layout>
        {QUICK_REACTIONS.map((key) => (
          <motion.button
            key={key}
            type="button"
            className="message-menu__reaction"
            onClick={() => {
              onReact(message, key);
              onClose();
            }}
            title={key}
            whileHover={{ scale: 1.14 }}
            whileTap={{ scale: 0.9 }}
            transition={transition.fast}
          >
            {key}
          </motion.button>
        ))}
      </motion.div>
      <motion.button type="button" role="menuitem" onClick={() => runAction("reply")} whileTap={{ scale: 0.98 }}>
        <Reply size={17} />
        <span>Ответить</span>
      </motion.button>
      {message.own && (
        <motion.button type="button" role="menuitem" onClick={() => runAction("edit")} whileTap={{ scale: 0.98 }}>
          <Pencil size={16} />
          <span>Изменить</span>
        </motion.button>
      )}
      <motion.button type="button" role="menuitem" onClick={() => runAction("copy")} whileTap={{ scale: 0.98 }}>
        <Copy size={16} />
        <span>Копировать текст</span>
      </motion.button>
      <motion.button type="button" role="menuitem" onClick={() => runAction("forward")} whileTap={{ scale: 0.98 }}>
        <Forward size={17} />
        <span>Переслать</span>
      </motion.button>
      {message.own && (
        <motion.button
          type="button"
          role="menuitem"
          className="message-menu__danger"
          onClick={() => runAction("delete")}
          whileTap={{ scale: 0.98 }}
        >
          <Trash2 size={16} />
          <span>Удалить</span>
        </motion.button>
      )}
    </motion.div>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
