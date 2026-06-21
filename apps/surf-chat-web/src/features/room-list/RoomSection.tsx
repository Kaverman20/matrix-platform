import { AnimatePresence, motion, Reorder } from "framer-motion";
import { ChevronDown, Hash, MoreHorizontal, Plus } from "lucide-react";
import type { ReactNode } from "react";
import type { MatrixRoomSummary } from "@matrix-platform/matrix-core";
import { formatUnreadCount } from "@matrix-platform/matrix-core";
import { fadeUp, transition } from "@matrix-platform/ui";
import { AuthedImage } from "../../components/AuthedImage";
import { useRoomListTimeFormatter } from "../../app/providers/usePreferences";

type SectionProps = {
  title: string;
  icon: ReactNode;
  rooms: MatrixRoomSummary[];
  open: boolean;
  onToggleOpen: () => void;
  activeRoomId: string | null;
  collapsed: boolean;
  onSelectRoom: (roomId: string) => void;
  onShowTip: (text: string, element: HTMLElement) => void;
  onHideTip: () => void;
  reorderable?: boolean;
  onReorder?: (rooms: MatrixRoomSummary[]) => void;
  onAdd?: () => void;
  addLabel?: string;
  onOpenRowMenu: (room: MatrixRoomSummary, x: number, y: number) => void;
};

function RoomRowBadge({
  mentions,
  unread,
  corner = false,
}: {
  mentions: number;
  unread: number;
  corner?: boolean;
}) {
  const mention = mentions > 0;
  const count = mention ? mentions : unread;
  if (count <= 0) return null;

  return (
    <span
      className={`room-row__badge${mention ? " room-row__badge--mention" : ""}${corner ? " room-row__badge--corner" : ""}`}
    >
      {formatUnreadCount(count)}
    </span>
  );
}

export function RoomSection({
  title,
  icon,
  rooms,
  open,
  onToggleOpen,
  activeRoomId,
  collapsed,
  onSelectRoom,
  onShowTip,
  onHideTip,
  reorderable = false,
  onReorder,
  onAdd,
  addLabel,
  onOpenRowMenu,
}: SectionProps) {
  const formatTime = useRoomListTimeFormatter();
  if (rooms.length === 0 && !onAdd) return null;
  if (collapsed && rooms.length === 0) return null;
  const renderRoom = (room: MatrixRoomSummary, index: number) => {
    const isActive = room.id === activeRoomId;

    return (
      <motion.div
        key={room.id}
        role="button"
        tabIndex={0}
        className={`room-row${isActive ? " is-active" : ""}${room.favourite ? " room-row--fav" : ""}${room.mentions > 0 && !isActive ? " room-row--mentioned" : ""}`}
        onClick={() => onSelectRoom(room.id)}
        onContextMenu={(event) => {
          event.preventDefault();
          onOpenRowMenu(room, event.clientX, event.clientY);
        }}
        onMouseEnter={(event) => onShowTip(room.name, event.currentTarget)}
        onMouseLeave={onHideTip}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelectRoom(room.id);
          }
        }}
        initial="hidden"
        animate="visible"
        variants={fadeUp}
        transition={{ ...transition.base, delay: Math.min(index * 0.02, 0.3) }}
        whileTap={{ scale: 0.99 }}
      >
        {isActive && (
          <motion.span
            className="room-row__bg"
            layoutId="room-list-active-bg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={transition.fast}
          />
        )}
        <span className="room-row__avatar" style={{ background: room.color }}>
          {room.kind === "channel" ? <Hash size={17} /> : room.name.slice(0, 1).toUpperCase()}
          {room.avatarUrl && <AuthedImage url={room.avatarUrl} className="room-row__avatar-img" />}
          {collapsed && (room.mentions > 0 || room.unread > 0) && (
            <RoomRowBadge mentions={room.mentions} unread={room.unread} corner />
          )}
        </span>
        <span className="room-row__main">
          <span className="room-row__top">
            <strong>{room.name}</strong>
            <time>{formatTime(room.timestamp)}</time>
          </span>
          <span className="room-row__preview">{room.preview || room.topic || "Нет сообщений"}</span>
        </span>
        <span className="room-row__meta">
          {!collapsed && (room.mentions > 0 || room.unread > 0) && (
            <RoomRowBadge mentions={room.mentions} unread={room.unread} />
          )}
          <button
            type="button"
            className="room-row__more"
            title="Ещё"
            aria-label="Действия с чатом"
            onClick={(event) => {
              event.stopPropagation();
              const rect = event.currentTarget.getBoundingClientRect();
              onOpenRowMenu(room, rect.right, rect.bottom);
            }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <MoreHorizontal size={16} />
          </button>
        </span>
      </motion.div>
    );
  };

  return (
    <section className={`room-section${open ? "" : " room-section--closed"}`}>
      <AnimatePresence initial={false} mode="popLayout">
        {collapsed ? (
          <motion.button
            key="compact"
            type="button"
            className="room-section__head-compact"
            title={title}
            aria-label={title}
            aria-expanded={open}
            onClick={onToggleOpen}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 24 }}
            exit={{ opacity: 0, height: 0 }}
            transition={transition.fast}
          >
            <motion.span
              className="room-section__chevron"
              animate={{ rotate: open ? 0 : -90 }}
              transition={transition.fast}
            >
              <ChevronDown size={12} />
            </motion.span>
            <span className="room-section__icon">{icon}</span>
          </motion.button>
        ) : (
          <motion.div
            key="full"
            className="room-section__head"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 28 }}
            exit={{ opacity: 0, height: 0 }}
            transition={transition.fast}
          >
            <button
              type="button"
              className="room-section__title"
              aria-label={title}
              aria-expanded={open}
              onClick={onToggleOpen}
            >
              <motion.span
                className="room-section__chevron"
                animate={{ rotate: open ? 0 : -90 }}
                transition={transition.fast}
              >
                <ChevronDown size={14} />
              </motion.span>
              <span className="room-section__icon">{icon}</span>
              <span>{title}</span>
            </button>
            {onAdd && (
              <button
                type="button"
                className="room-section__add"
                title={addLabel}
                aria-label={addLabel}
                onClick={onAdd}
              >
                <Plus size={15} />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      <div className={`room-section__body${open ? " is-open" : ""}`}>
        <div className="room-section__body-inner">
          {reorderable && onReorder ? (
            <Reorder.Group
              as="div"
              axis="y"
              values={rooms}
              onReorder={onReorder}
              className="room-section__items"
            >
              {rooms.map((room, index) => (
                <Reorder.Item
                  as="div"
                  key={room.id}
                  value={room}
                  className="room-row__reorder-item"
                  whileDrag={{ scale: 1.02 }}
                  dragElastic={0.08}
                >
                  {renderRoom(room, index)}
                </Reorder.Item>
              ))}
            </Reorder.Group>
          ) : (
            <div className="room-section__items">
              {rooms.map(renderRoom)}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
