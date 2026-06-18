import { useCallback, useEffect, useRef, useState } from "react";

type Point = { x: number; y: number };

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Center of the viewport — default for each new call / incoming ring. */
export function centeredPanelPosition(width: number, height: number): Point {
  return {
    x: Math.max(8, Math.round((window.innerWidth - width) / 2)),
    y: Math.max(8, Math.round((window.innerHeight - height) / 2)),
  };
}

function clampToViewport(point: Point, width: number, height: number): Point {
  return {
    x: clamp(point.x, 8, window.innerWidth - width - 8),
    y: clamp(point.y, 8, window.innerHeight - height - 8),
  };
}

/** Draggable floating panel. Remount the parent with a new `key` to recenter. */
export function useDraggablePanel(width: number, height: number) {
  const [position, setPosition] = useState<Point>(() =>
    centeredPanelPosition(width, height),
  );
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(
    null,
  );

  useEffect(() => {
    const onResize = () =>
      setPosition((current) => clampToViewport(current, width, height));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [height, width]);

  const onDragPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      dragRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        originX: position.x,
        originY: position.y,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [position.x, position.y],
  );

  const onDragPointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
      setPosition(
        clampToViewport(
          {
            x: drag.originX + (event.clientX - drag.startX),
            y: drag.originY + (event.clientY - drag.startY),
          },
          width,
          height,
        ),
      );
    },
    [height, width],
  );

  const onDragPointerUp = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }, []);

  return { position, onDragPointerDown, onDragPointerMove, onDragPointerUp };
}
