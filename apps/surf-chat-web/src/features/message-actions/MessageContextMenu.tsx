import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronRight, Copy, Forward, MessagesSquare, Pencil, Pin, Reply, Trash2 } from "lucide-react";
import type { MatrixMessage } from "@matrix-platform/matrix-core";
import { EmojiPicker } from "../../components/EmojiPicker";
import "./message-context-menu.css";

export type MessageAction = "reply" | "thread" | "edit" | "copy" | "forward" | "pin" | "delete";
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
    // Anchor handles position + the (compositor-only) vertical shift when the
    // emoji picker would overflow the viewport. The menu itself animates in via
    // a CSS keyframe — kept off the main thread so it stays smooth on battery.
    <div
      className="message-menu-anchor"
      style={{ left, top, transform: `translateY(${-pickerOverflow}px)` }}
    >
      <div
        ref={ref}
        className="message-menu"
        role="menu"
        aria-label="Действия с сообщением"
        onContextMenu={(event) => event.preventDefault()}
      >
        <div className="message-menu__quick" aria-label="Быстрые реакции">
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
        </div>
        <div className="message-menu__body">
          {pickerOpen ? (
            <div className="message-menu__picker message-menu__fade">
              <EmojiPicker
                onSelect={(native) => {
                  onReact(message, native);
                  onClose();
                }}
              />
            </div>
          ) : (
            <ul className="message-menu__list message-menu__fade">
              <li>
                <button type="button" role="menuitem" className="message-menu__action" onClick={() => runAction("reply")}>
                  <Reply size={17} />
                  <span>Ответить</span>
                </button>
              </li>
              <li>
                <button type="button" role="menuitem" className="message-menu__action" onClick={() => runAction("thread")}>
                  <MessagesSquare size={16} />
                  <span>Ответить в треде</span>
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
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
