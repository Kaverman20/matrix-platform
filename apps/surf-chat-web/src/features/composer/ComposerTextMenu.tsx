import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronRight,
  ClipboardPaste,
  Copy,
  Scissors,
  Wand2,
} from "lucide-react";
import type { TextTransformMode, TextWrapMode } from "@matrix-platform/matrix-core";
import "./composer-text-menu.css";

type Props = {
  x: number;
  y: number;
  hasSelection: boolean;
  onClose: () => void;
  onWrap: (mode: TextWrapMode) => void;
  onTransform: (mode: TextTransformMode) => void;
  onCut: () => void;
  onCopy: () => void;
  onPaste: () => void;
};

const SAFE = 12;
const SUBMENU_GAP = 2;

type SubmenuItem =
  | { kind: "wrap"; mode: TextWrapMode; label: string; shortcut?: string }
  | { kind: "transform"; mode: TextTransformMode; label: string }
  | { kind: "sep" };

const SUBMENU_ITEMS: SubmenuItem[] = [
  { kind: "transform", mode: "clear", label: "Убрать форматирование" },
  { kind: "sep" },
  { kind: "wrap", mode: "strikethrough", label: "Зачёркнутый", shortcut: "⇧⌘X" },
  { kind: "wrap", mode: "code", label: "Моноширинный", shortcut: "⇧⌘K" },
  { kind: "wrap", mode: "italic", label: "Курсив", shortcut: "⌘I" },
  { kind: "wrap", mode: "bold", label: "Жирный", shortcut: "⌘B" },
  { kind: "wrap", mode: "link", label: "Добавить ссылку", shortcut: "⌘U" },
  { kind: "wrap", mode: "quote", label: "Цитата", shortcut: "⇧⌘I" },
  { kind: "sep" },
  { kind: "transform", mode: "upper", label: "АБВ прописные" },
  { kind: "transform", mode: "lower", label: "абв строчные" },
  { kind: "transform", mode: "title", label: "Абв с заглавной буквы" },
];

export function ComposerTextMenu({
  x,
  y,
  hasSelection,
  onClose,
  onWrap,
  onTransform,
  onCut,
  onCopy,
  onPaste,
}: Props) {
  const panelRef = useRef<HTMLUListElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const submenuRef = useRef<HTMLUListElement>(null);
  const closeTimerRef = useRef<number | null>(null);

  const [panelPos, setPanelPos] = useState<{ left: number; top: number } | null>(null);
  const [submenuPos, setSubmenuPos] = useState<{ left: number; top: number } | null>(null);
  const [submenuFlip, setSubmenuFlip] = useState(false);
  const [submenuOpen, setSubmenuOpen] = useState(false);

  const clearCloseTimer = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const openSubmenu = () => {
    clearCloseTimer();
    setSubmenuOpen(true);
  };

  const scheduleCloseSubmenu = () => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => setSubmenuOpen(false), 120);
  };

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    const width = panel.offsetWidth;
    const height = panel.offsetHeight;
    const left = clamp(x, SAFE, window.innerWidth - width - SAFE);
    let top = clamp(y, SAFE, window.innerHeight - height - SAFE);
    if (top + height + SAFE > window.innerHeight) {
      top = clamp(y - height, SAFE, window.innerHeight - height - SAFE);
    }
    setPanelPos({ left, top });
  }, [hasSelection, x, y]);

  useLayoutEffect(() => {
    if (!submenuOpen) {
      setSubmenuPos(null);
      setSubmenuFlip(false);
      return;
    }

    const trigger = triggerRef.current;
    const submenu = submenuRef.current;
    if (!trigger || !submenu) return;

    const triggerRect = trigger.getBoundingClientRect();
    const submenuWidth = submenu.offsetWidth;
    const submenuHeight = submenu.offsetHeight;

    let left = triggerRect.right + SUBMENU_GAP;
    let top = triggerRect.top - 5;
    let flip = false;

    if (left + submenuWidth + SAFE > window.innerWidth) {
      left = triggerRect.left - submenuWidth - SUBMENU_GAP;
      flip = true;
    }

    if (top + submenuHeight + SAFE > window.innerHeight) {
      top = window.innerHeight - submenuHeight - SAFE;
    }
    top = clamp(top, SAFE, window.innerHeight - submenuHeight - SAFE);

    setSubmenuFlip(flip);
    setSubmenuPos({ left, top });
  }, [submenuOpen, panelPos]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        panelRef.current?.contains(target)
        || submenuRef.current?.contains(target)
      ) {
        return;
      }
      onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [onClose]);

  useEffect(() => () => clearCloseTimer(), []);

  const runWrap = (mode: TextWrapMode) => {
    onWrap(mode);
    onClose();
  };

  const runTransform = (mode: TextTransformMode) => {
    onTransform(mode);
    onClose();
  };

  const panelStyle = panelPos
    ? { left: panelPos.left, top: panelPos.top }
    : { left: x, top: y, visibility: "hidden" as const };

  const submenuStyle = submenuPos
    ? { left: submenuPos.left, top: submenuPos.top }
    : { visibility: "hidden" as const };

  return createPortal(
    <>
      <ul
        ref={panelRef}
        className="composer-text-menu composer-text-menu__panel"
        style={panelStyle}
        role="menu"
      >
        <li>
          <button
            type="button"
            className="composer-text-menu__action"
            disabled={!hasSelection}
            onClick={() => { onCut(); onClose(); }}
          >
            <Scissors size={16} />
            <span>Вырезать</span>
          </button>
        </li>
        <li>
          <button
            type="button"
            className="composer-text-menu__action"
            disabled={!hasSelection}
            onClick={() => { onCopy(); onClose(); }}
          >
            <Copy size={16} />
            <span>Скопировать</span>
          </button>
        </li>
        <li>
          <button
            type="button"
            className="composer-text-menu__action"
            onClick={() => { void onPaste(); onClose(); }}
          >
            <ClipboardPaste size={16} />
            <span>Вставить</span>
          </button>
        </li>

        {hasSelection && (
          <>
            <li className="composer-text-menu__sep" aria-hidden="true" />
            <li
              className={`composer-text-menu__submenu-row${submenuOpen ? " is-open" : ""}`}
              onMouseEnter={openSubmenu}
              onMouseLeave={scheduleCloseSubmenu}
            >
              <button
                ref={triggerRef}
                type="button"
                className="composer-text-menu__action composer-text-menu__action--submenu"
                onFocus={openSubmenu}
                onBlur={scheduleCloseSubmenu}
              >
                <Wand2 size={16} />
                <span>Преобразования</span>
                <ChevronRight size={15} className="composer-text-menu__chevron" />
              </button>
            </li>
          </>
        )}
      </ul>

      {hasSelection && submenuOpen && (
        <ul
          ref={submenuRef}
          className={`composer-text-menu composer-text-menu__submenu${submenuFlip ? " composer-text-menu__submenu--flip" : ""}`}
          style={submenuStyle}
          role="menu"
          onMouseEnter={openSubmenu}
          onMouseLeave={scheduleCloseSubmenu}
        >
          {SUBMENU_ITEMS.map((item, index) => {
            if (item.kind === "sep") {
              return <li key={`sep-${index}`} className="composer-text-menu__sep" aria-hidden="true" />;
            }

            return (
              <li key={item.label}>
                <button
                  type="button"
                  className="composer-text-menu__action composer-text-menu__action--compact"
                  onClick={() => {
                    if (item.kind === "wrap") runWrap(item.mode);
                    else runTransform(item.mode);
                  }}
                >
                  <span>{item.label}</span>
                  {"shortcut" in item && item.shortcut ? <kbd>{item.shortcut}</kbd> : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>,
    document.body,
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
