import { useCallback, useRef, useState } from "react";

type Point = { x: number; y: number };

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

const MARGIN = 8;

/**
 * Перетаскивание собственного видео (PiP) внутри stage звонка — как в Zoom/Meet:
 * можно бросить превью в любой угол/место. До первого перетаскивания позиция не
 * задана (CSS держит правый нижний угол), дальше — свободно, с привязкой к stage.
 */
export function useDraggablePip() {
  const stageRef = useRef<HTMLDivElement>(null);
  const elRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const [pos, setPos] = useState<Point | null>(null);

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    const el = elRef.current;
    if (!el) return;
    event.preventDefault();
    const rect = el.getBoundingClientRect();
    dragRef.current = { dx: event.clientX - rect.left, dy: event.clientY - rect.top };
    el.setPointerCapture(event.pointerId);
  }, []);

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    const stage = stageRef.current;
    const el = elRef.current;
    if (!drag || !stage || !el) return;
    const stageRect = stage.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const x = clamp(
      event.clientX - stageRect.left - drag.dx,
      MARGIN,
      stageRect.width - elRect.width - MARGIN,
    );
    const y = clamp(
      event.clientY - stageRect.top - drag.dy,
      MARGIN,
      stageRect.height - elRect.height - MARGIN,
    );
    setPos({ x, y });
  }, []);

  const onPointerUp = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    elRef.current?.releasePointerCapture(event.pointerId);
  }, []);

  // Сброс к углу по умолчанию (например, при смене размера окна).
  const reset = useCallback(() => setPos(null), []);

  const pipStyle: React.CSSProperties | undefined = pos
    ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" }
    : undefined;

  return { stageRef, elRef, pipStyle, reset, onPointerDown, onPointerMove, onPointerUp };
}
