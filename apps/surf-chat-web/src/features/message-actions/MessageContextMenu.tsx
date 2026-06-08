import { useEffect, useRef } from "react";
import { Copy, Forward, Pencil, Reply, Trash2 } from "lucide-react";
import type { MatrixMessage } from "@matrix-platform/matrix-core";
import "./message-context-menu.css";

export type MessageAction = "reply" | "edit" | "copy" | "forward" | "delete";

type Props = {
  message: MatrixMessage;
  x: number;
  y: number;
  onClose: () => void;
  onAction: (action: MessageAction, message: MatrixMessage) => void;
};

const MENU_WIDTH = 236;
const MENU_HEIGHT = 238;
const SAFE_OFFSET = 12;

export function MessageContextMenu({ message, x, y, onAction, onClose }: Props) {
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
    <div
      ref={ref}
      className="message-menu"
      style={{ left, top }}
      role="menu"
      aria-label="Действия с сообщением"
    >
      <button type="button" role="menuitem" onClick={() => runAction("reply")}>
        <Reply size={17} />
        <span>Ответить</span>
      </button>
      {message.own && (
        <button type="button" role="menuitem" onClick={() => runAction("edit")}>
          <Pencil size={16} />
          <span>Изменить</span>
        </button>
      )}
      <button type="button" role="menuitem" onClick={() => runAction("copy")}>
        <Copy size={16} />
        <span>Копировать текст</span>
      </button>
      <button type="button" role="menuitem" onClick={() => runAction("forward")}>
        <Forward size={17} />
        <span>Переслать</span>
      </button>
      {message.own && (
        <button
          type="button"
          role="menuitem"
          className="message-menu__danger"
          onClick={() => runAction("delete")}
        >
          <Trash2 size={16} />
          <span>Удалить</span>
        </button>
      )}
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
