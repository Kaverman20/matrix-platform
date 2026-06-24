import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

export type ComboOption = { value: string; label: string };

/**
 * Одиночный комбобокс с поиском — для больших списков (сотни групп Keycloak).
 * Триггер + выпадающее меню с инпутом-поиском и фильтрованным списком.
 */
export function SearchSelect({
  value,
  options,
  onChange,
  placeholder = "— выберите —",
  searchPlaceholder = "Поиск…",
  ariaLabel,
}: {
  value: string;
  options: ComboOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  return (
    <div className="access-combo" ref={wrapRef}>
      <button
        type="button"
        className="access-combo__trigger"
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={selected ? undefined : "access-combo__placeholder"}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={16} className={`access-combo__chev${open ? " is-open" : ""}`} />
      </button>

      {open && (
        <div className="access-combo__menu">
          <div className="access-combo__search">
            <Search size={15} />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
            />
          </div>
          <div className="access-combo__list">
            {filtered.length === 0 && <div className="access-combo__empty">Ничего не найдено</div>}
            {filtered.slice(0, 300).map((o) => (
              <button
                key={o.value}
                type="button"
                className={`access-combo__option${o.value === value ? " is-active" : ""}`}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                  setQuery("");
                }}
              >
                <span className="access-combo__option-label">{o.label}</span>
                {o.value === value && <Check size={15} />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
