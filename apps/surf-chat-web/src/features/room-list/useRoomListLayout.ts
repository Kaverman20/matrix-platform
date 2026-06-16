import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

const ROOM_LIST_WIDTH = 304;
const ROOM_LIST_MAX = 440;
const ROOM_LIST_COLLAPSED_WIDTH = 84;
const ROOM_LIST_COLLAPSE_THRESHOLD = 200;
const RAIL_WIDTH = 72;

export type RoomListLayout = {
  width: number;
  collapsed: boolean;
  resizing: boolean;
  toggleCollapse: () => void;
  startResize: (event: ReactPointerEvent) => void;
};

/** Width / collapse / drag-resize state for the room list column. Self-contained:
 * the only inputs are pointer events, the outputs drive the column's inline width
 * and the resizer handle. */
export function useRoomListLayout(): RoomListLayout {
  const [collapsed, setCollapsed] = useState(false);
  const [width, setWidth] = useState(ROOM_LIST_WIDTH);
  const [resizing, setResizing] = useState(false);
  const widthRef = useRef(width);
  const lastWidth = useRef(ROOM_LIST_WIDTH);

  const toggleCollapse = () => {
    if (collapsed) {
      setCollapsed(false);
      setWidth(lastWidth.current);
      widthRef.current = lastWidth.current;
    } else {
      lastWidth.current = width;
      setCollapsed(true);
      setWidth(ROOM_LIST_COLLAPSED_WIDTH);
      widthRef.current = ROOM_LIST_COLLAPSED_WIDTH;
    }
  };

  const startResize = (event: ReactPointerEvent) => {
    event.preventDefault();
    setResizing(true);

    const onMove = (moveEvent: PointerEvent) => {
      const nextWidth = Math.min(
        ROOM_LIST_MAX,
        Math.max(ROOM_LIST_COLLAPSED_WIDTH, moveEvent.clientX - RAIL_WIDTH),
      );
      widthRef.current = nextWidth;
      setWidth(nextWidth);
      setCollapsed(nextWidth < ROOM_LIST_COLLAPSE_THRESHOLD);
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setResizing(false);

      const nextWidth = widthRef.current;
      if (nextWidth < ROOM_LIST_COLLAPSE_THRESHOLD) {
        setWidth(ROOM_LIST_COLLAPSED_WIDTH);
        widthRef.current = ROOM_LIST_COLLAPSED_WIDTH;
        setCollapsed(true);
      } else {
        lastWidth.current = nextWidth;
        setCollapsed(false);
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return { width, collapsed, resizing, toggleCollapse, startResize };
}
