import { Check, ChevronDown } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ThemePreview } from "../../app/providers/themePresets";
import { ThemeSwatch } from "./ThemeSwatch";

export type SettingsSelectOption<T extends string> = {
  value: T;
  label: string;
  hint?: string;
  preview?: ThemePreview;
};

type Props<T extends string> = {
  value: T;
  options: SettingsSelectOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
};

type MenuPos = { top: number; left: number; width: number };

export function SettingsSelect<T extends string>({ value, options, onChange, ariaLabel }: Props<T>) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<MenuPos | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const selected = options.find((o) => o.value === value) ?? options[0];

  const close = useCallback(() => setOpen(false), []);

  const openMenu = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.max(rect.width, 260);
    const left = Math.min(rect.right - width, window.innerWidth - width - 12);
    setMenuPos({
      top: rect.bottom + 6,
      left: Math.max(12, left),
      width,
    });
    setOpen(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      const node = event.target as Node;
      if (triggerRef.current?.contains(node) || menuRef.current?.contains(node)) return;
      close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.max(rect.width, 260);
    const left = Math.min(rect.right - width, window.innerWidth - width - 12);
    setMenuPos({
      top: rect.bottom + 6,
      left: Math.max(12, left),
      width,
    });
  }, [open]);

  const pick = (next: T) => {
    onChange(next);
    close();
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`settings-select${open ? " is-open" : ""}`}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => (open ? close() : openMenu())}
      >
        <span className="settings-select__value">
          {selected.preview && <ThemeSwatch preview={selected.preview} />}
          <span className="settings-select__label">{selected.label}</span>
        </span>
        <ChevronDown size={16} className="settings-select__chevron" />
      </button>

      {open &&
        menuPos &&
        createPortal(
          <div
            ref={menuRef}
            id={listId}
            role="listbox"
            aria-label={ariaLabel}
            className="settings-select__menu"
            style={{ top: menuPos.top, left: menuPos.left, width: menuPos.width }}
          >
            {options.map((option) => {
              const active = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`settings-select__option${active ? " is-active" : ""}`}
                  onClick={() => pick(option.value)}
                >
                  <span className="settings-select__optionMain">
                    {option.preview && <ThemeSwatch preview={option.preview} />}
                    <span className="settings-select__optionText">
                      <span className="settings-select__optionLabel">{option.label}</span>
                      {option.hint && (
                        <span className="settings-select__optionHint">{option.hint}</span>
                      )}
                    </span>
                  </span>
                  {active && <Check size={16} className="settings-select__check" />}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}
