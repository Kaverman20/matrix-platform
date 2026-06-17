import { Keyboard, LogOut, Settings } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./help-menu.css";

type Props = {
  onOpenSettings: () => void;
  onLogout: () => void;
};

type MenuPos = { bottom: number; left: number; width: number };

export function HelpMenu({ onOpenSettings, onLogout }: Props) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<MenuPos | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const close = useCallback(() => setOpen(false), []);

  const updatePosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 260;
    setMenuPos({
      bottom: window.innerHeight - rect.top + 8,
      left: Math.max(12, rect.left + rect.width / 2 - width / 2),
      width,
    });
  }, []);

  const toggle = () => {
    if (open) {
      close();
      return;
    }
    updatePosition();
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const onPointer = (event: MouseEvent) => {
      const node = event.target as Node;
      if (triggerRef.current?.contains(node) || menuRef.current?.contains(node)) return;
      close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, close, updatePosition]);

  const pickSettings = () => {
    close();
    onOpenSettings();
  };

  const pickLogout = () => {
    close();
    onLogout();
  };

  return (
    <div className="help-menu">
      <button
        ref={triggerRef}
        type="button"
        className={`space-rail__item space-rail__item--add help-menu__trigger${open ? " is-open" : ""}`}
        title="Справка и настройки"
        aria-label="Справка и настройки"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={toggle}
      >
        ?
      </button>

      {open &&
        menuPos &&
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            className="help-menu__popover"
            style={{
              bottom: menuPos.bottom,
              left: menuPos.left,
              width: menuPos.width,
            }}
          >
            <button type="button" role="menuitem" className="help-menu__item" onClick={pickSettings}>
              <Settings size={16} />
              <span>Настройки</span>
            </button>
            <button type="button" role="menuitem" className="help-menu__item" disabled>
              <Keyboard size={16} />
              <span>Горячие клавиши</span>
              <span className="help-menu__itemHint">скоро</span>
            </button>
            <div className="help-menu__divider" role="separator" />
            <button
              type="button"
              role="menuitem"
              className="help-menu__item help-menu__item--danger"
              onClick={pickLogout}
            >
              <LogOut size={16} />
              <span>Выйти</span>
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
}
