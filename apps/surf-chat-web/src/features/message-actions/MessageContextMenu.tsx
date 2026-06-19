import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, CheckSquare, ChevronRight, Copy, Forward, History, Link2, MessagesSquare, Pencil, Pin, Reply, Trash2 } from "lucide-react";
import type { MatrixMessage } from "@matrix-platform/matrix-core";
import { EmojiPicker } from "../../components/EmojiPicker";
import "./message-context-menu.css";

export type MessageAction = "reply" | "thread" | "edit" | "copy" | "forward" | "pin" | "delete" | "link" | "select" | "history";
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

const SAFE_OFFSET = 12;

export function MessageContextMenu({ canPin, message, x, y, onAction, onClose, onReact }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number; flip: boolean } | null>(null);

  useLayoutEffect(() => {
    const menu = ref.current;
    if (!menu) return;

    const width = menu.offsetWidth;
    const height = menu.offsetHeight;
    const left = clamp(x, SAFE_OFFSET, window.innerWidth - width - SAFE_OFFSET);

    let top = y;
    let flip = false;
    if (top + height + SAFE_OFFSET > window.innerHeight) {
      top = y - height;
      flip = true;
    }
    top = clamp(top, SAFE_OFFSET, window.innerHeight - height - SAFE_OFFSET);

    setPosition({ left, top, flip });
  }, [canPin, message.own, message.pinned, pickerOpen, x, y]);

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

  const anchorStyle = position
    ? { left: position.left, top: position.top }
    : { left: x, top: y, visibility: "hidden" as const };

  return (
    <div
      className={`message-menu-anchor${position?.flip ? " message-menu-anchor--flip" : ""}`}
      style={anchorStyle}
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
                <button type="button" role="menuitem" className="message-menu__action" onClick={() => runAction("select")}>
                  <CheckSquare size={16} />
                  <span>Выбрать</span>
                </button>
              </li>
              {message.edited && (
                <li>
                  <button type="button" role="menuitem" className="message-menu__action" onClick={() => runAction("history")}>
                    <History size={16} />
                    <span>История изменений</span>
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
                <button type="button" role="menuitem" className="message-menu__action" onClick={() => runAction("link")}>
                  <Link2 size={16} />
                  <span>Копировать ссылку</span>
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
