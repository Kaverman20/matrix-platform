import { useEffect, useRef } from "react";
import type { MessageReader } from "@matrix-platform/matrix-core";
import "./read-receipts-popover.css";

type Props = {
  readers: MessageReader[];
  anchorRect: DOMRect;
  onClose: () => void;
};

export function ReadReceiptsPopover({ readers, anchorRect, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const top = Math.min(window.innerHeight - 16, anchorRect.bottom + 8);
  const left = Math.min(window.innerWidth - 280, Math.max(16, anchorRect.left - 120));

  return (
    <div
      ref={ref}
      className="read-receipts-popover"
      style={{ top, left }}
      role="dialog"
      aria-label="Кто прочитал"
    >
      <strong>Прочитали</strong>
      {readers.length === 0 ? (
        <p className="read-receipts-popover__empty">Пока никто</p>
      ) : (
        <ul>
          {readers.map((reader) => (
            <li key={reader.userId}>
              <span className="read-receipts-popover__avatar" style={reader.avatarUrl ? undefined : { background: "var(--color-accent-subtle)" }}>
                {reader.avatarUrl ? <img src={reader.avatarUrl} alt="" /> : reader.name.slice(0, 1).toUpperCase()}
              </span>
              <span>{reader.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
