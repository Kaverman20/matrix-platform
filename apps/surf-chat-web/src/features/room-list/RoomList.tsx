import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, Reorder } from "framer-motion";
import { Boxes, ChevronDown, ChevronLeft, ChevronRight, Hash, Loader2, LogOut, MessageCircle, MoreHorizontal, PanelLeftClose, PanelLeftOpen, Plus, Search, Settings, Star, UserPlus } from "lucide-react";
import type { MatrixRoomSummary, MatrixSpaceSummary, UserDirectoryEntry } from "@matrix-platform/matrix-core";
import { colorForId, filterRoomSummaries, formatUnreadCount } from "@matrix-platform/matrix-core";
import { fadeUp, transition } from "@matrix-platform/ui";
import type { SidebarView } from "../../app/chatUrl";
import { useMatrix } from "../../app/providers/MatrixContext";
import { AuthedImage } from "../media/AuthedImage";
import { useRoomListTimeFormatter } from "../settings/usePreferences";
import { useSidebarUserSearch } from "./useSidebarUserSearch";
import "./room-list.css";

export type RoomListHandle = {
  focusSearch: () => void;
};

type Props = {
  favourites: MatrixRoomSummary[];
  channels: MatrixRoomSummary[];
  dms: MatrixRoomSummary[];
  activeRoomId: string | null;
  collapsed: boolean;
  sidebarView: SidebarView;
  activeSpaceId: string | null;
  activeSpace: MatrixSpaceSummary | null;
  subspaces: MatrixSpaceSummary[];
  parentSpaceName: string | null;
  onBack: () => void;
  onSelectSpace: (spaceId: string) => void;
  onToggleCollapsed: () => void;
  onSelectRoom: (roomId: string) => void;
  onToggleFavourite: (roomId: string) => void;
  onReorderFavourites: (rooms: MatrixRoomSummary[]) => void;
  onCreateChannel: () => void;
  onCreateDm: () => void;
  onStartDmWithUser: (userId: string) => void | Promise<void>;
  onCreateSubspace: () => void;
  onLeaveSpace: () => void;
  onOpenSettings: (roomId: string) => void;
  onLeaveRoom: (roomId: string) => void;
};

export const RoomList = forwardRef<RoomListHandle, Props>(function RoomList({
  favourites,
  channels,
  dms,
  activeRoomId,
  collapsed,
  sidebarView,
  activeSpaceId,
  activeSpace,
  subspaces,
  parentSpaceName,
  onBack,
  onSelectSpace,
  onToggleCollapsed,
  onSelectRoom,
  onToggleFavourite,
  onReorderFavourites,
  onCreateChannel,
  onCreateDm,
  onStartDmWithUser,
  onCreateSubspace,
  onLeaveSpace,
  onOpenSettings,
  onLeaveRoom,
}, ref) {
  const { client } = useMatrix();
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchPlaceholder = useMemo(
    () => "Комнаты и люди",
    [],
  );

  useImperativeHandle(ref, () => ({
    focusSearch: () => {
      if (collapsed) onToggleCollapsed();
      window.requestAnimationFrame(() => {
        const input = searchInputRef.current;
        input?.focus();
        input?.select();
      });
    },
  }), [collapsed, onToggleCollapsed]);
  const [tip, setTip] = useState<{ left: number; text: string; top: number } | null>(null);
  const [favouriteOrderIds, setFavouriteOrderIds] = useState<string[]>([]);
  const [spaceMenuOpen, setSpaceMenuOpen] = useState(false);
  const [rowMenu, setRowMenu] = useState<{ room: MatrixRoomSummary; x: number; y: number } | null>(null);
  const [subMenu, setSubMenu] = useState<{ space: MatrixSpaceSummary; x: number; y: number } | null>(null);
  const [openSections, setOpenSections] = useState({
    subspaces: true,
    favourites: true,
    channels: true,
    dms: true,
  });
  const spaceMenuRef = useRef<HTMLDivElement | null>(null);
  const rowMenuRef = useRef<HTMLDivElement | null>(null);
  const subMenuRef = useRef<HTMLDivElement | null>(null);
  const total = favourites.length + channels.length + dms.length;
  const searchValue = query.trim().toLowerCase();
  const existingDmUserIds = useMemo(
    () => dms.map((room) => room.directUserId),
    [dms],
  );
  const userSearch = useSidebarUserSearch({
    client,
    query,
    existingDmUserIds,
  });
  const visibleSubspaces = useMemo(
    () => (searchValue
      ? subspaces.filter((space) => space.name.toLowerCase().includes(searchValue))
      : subspaces),
    [subspaces, searchValue],
  );
  const orderedFavourites = useMemo(
    () => reconcileRoomsByIds(favourites, favouriteOrderIds),
    [favourites, favouriteOrderIds],
  );

  const visibleFavourites = useMemo(
    () => filterRoomSummaries(orderedFavourites, searchValue),
    [orderedFavourites, searchValue],
  );
  const visibleChannels = useMemo(
    () => filterRoomSummaries(channels, searchValue),
    [channels, searchValue],
  );
  const visibleDms = useMemo(
    () => filterRoomSummaries(dms, searchValue),
    [dms, searchValue],
  );
  const isDmsView = sidebarView === "dms";
  const isHomeView = sidebarView === "home";
  const canCreateDm = !searchValue && (isHomeView || isDmsView);
  const visibleTotal = visibleFavourites.length + visibleChannels.length + visibleDms.length;
  const showUserResults = !collapsed && userSearch.active;
  const hasSearchResults = visibleTotal > 0 || userSearch.users.length > 0;

  const handleStartDmWithUser = (userId: string) => {
    void Promise.resolve(onStartDmWithUser(userId)).then(() => {
      setQuery("");
    });
  };
  const showRoomTip = (text: string, element: HTMLElement) => {
    if (!collapsed) return;
    const rect = element.getBoundingClientRect();
    setTip({
      text,
      top: rect.top + rect.height / 2,
      left: rect.right + 10,
    });
  };

  useEffect(() => {
    if (!spaceMenuOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!spaceMenuRef.current?.contains(event.target as Node)) {
        setSpaceMenuOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSpaceMenuOpen(false);
      }
    };

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [spaceMenuOpen]);

  const openRowMenu = (room: MatrixRoomSummary, x: number, y: number) => {
    setSubMenu(null);
    setRowMenu({
      room,
      x: Math.min(x, window.innerWidth - 230),
      y: Math.min(y, window.innerHeight - 170),
    });
  };

  const openSubMenu = (space: MatrixSpaceSummary, x: number, y: number) => {
    setRowMenu(null);
    setSubMenu({
      space,
      x: Math.min(x, window.innerWidth - 230),
      y: Math.min(y, window.innerHeight - 140),
    });
  };

  useEffect(() => {
    if (!rowMenu && !subMenu) return;

    const onPointerDown = (event: PointerEvent) => {
      const node = event.target as Node;
      if (!rowMenuRef.current?.contains(node)) setRowMenu(null);
      if (!subMenuRef.current?.contains(node)) setSubMenu(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setRowMenu(null);
        setSubMenu(null);
      }
    };

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [rowMenu, subMenu]);

  return (
    <aside className={`room-list${collapsed ? " is-collapsed" : ""}`}>
      <div className="room-list__head" ref={spaceMenuRef}>
        {!collapsed && activeSpace && (
          <>
            <span className="space-bar__avatar" style={{ background: activeSpace.color }}>
              {activeSpace.label}
              <AuthedImage url={activeSpace.avatarUrl} className="space-bar__avatar-img" />
            </span>
            <span className="space-bar__name">{activeSpace.name}</span>
            <button
              type="button"
              className={`space-bar__more${spaceMenuOpen ? " is-open" : ""}`}
              title="Управление пространством"
              aria-label="Управление пространством"
              onClick={() => setSpaceMenuOpen((value) => !value)}
            >
              <MoreHorizontal size={18} />
            </button>
          </>
        )}
        {!collapsed && !activeSpace && isDmsView && (
          <div className="room-list__title">
            <strong>Личные сообщения</strong>
          </div>
        )}
        {!collapsed && !activeSpace && !isDmsView && (
          <div className="room-list__title">
            <strong>Surf Chat</strong>
          </div>
        )}
        <button
          type="button"
          className="room-list__collapse"
          title={collapsed ? "Развернуть" : "Свернуть"}
          onClick={onToggleCollapsed}
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
        <AnimatePresence>
          {spaceMenuOpen && (
            <motion.div
              className="space-bar__menu"
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={transition.fast}
            >
              <button
                type="button"
                className="space-bar__menuItem"
                onClick={() => {
                  setSpaceMenuOpen(false);
                  if (activeSpace) onOpenSettings(activeSpace.id);
                }}
              >
                <Settings size={16} />
                <span>Настройки пространства</span>
              </button>
              <div className="row-menu__divider" />
              <button
                type="button"
                className="space-bar__menuItem space-bar__menuItem--danger"
                onClick={() => {
                  setSpaceMenuOpen(false);
                  onLeaveSpace();
                }}
              >
                <LogOut size={16} />
                <span>Выйти из пространства</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={transition.slow}
            style={{ overflow: "hidden" }}
          >
            <label className="room-list__search">
              <Search size={16} />
              <input
                ref={searchInputRef}
                value={query}
                placeholder={searchPlaceholder}
                aria-label="Поиск комнат и людей"
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape" && query) {
                    event.stopPropagation();
                    setQuery("");
                  }
                }}
              />
            </label>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="room-list__sections">
        {!collapsed && parentSpaceName && (
          <button type="button" className="room-list__back" onClick={onBack}>
            <ChevronLeft size={16} />
            <span>{parentSpaceName}</span>
          </button>
        )}
        {!collapsed && activeSpaceId && visibleSubspaces.length > 0 && (
          <section className="room-section">
            <div className="room-section__head">
              <button
                type="button"
                className="room-section__title"
                onClick={() => setOpenSections((state) => ({ ...state, subspaces: !state.subspaces }))}
              >
                <motion.span
                  className="room-section__chevron"
                  animate={{ rotate: openSections.subspaces ? 0 : -90 }}
                  transition={transition.fast}
                >
                  <ChevronDown size={14} />
                </motion.span>
                <span className="room-section__icon"><Boxes size={14} /></span>
                <span>Сабспейсы</span>
              </button>
              <button
                type="button"
                className="room-section__add"
                title="Создать сабспейс"
                aria-label="Создать сабспейс"
                onClick={onCreateSubspace}
              >
                <Plus size={15} />
              </button>
            </div>
            <div className={`room-section__body${openSections.subspaces ? " is-open" : ""}`}>
              <div className="room-section__body-inner">
                {visibleSubspaces.map((space) => (
                  <div
                    key={space.id}
                    role="button"
                    tabIndex={0}
                    className="room-subspace"
                    onClick={() => onSelectSpace(space.id)}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      openSubMenu(space, event.clientX, event.clientY);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelectSpace(space.id);
                      }
                    }}
                  >
                    <span className="room-subspace__avatar" style={{ background: space.color }}>
                      {space.label}
                      {space.avatarUrl && <AuthedImage url={space.avatarUrl} className="room-subspace__avatar-img" />}
                    </span>
                    <strong>{space.name}</strong>
                    <button
                      type="button"
                      className="room-subspace__more"
                      title="Действия с пространством"
                      aria-label="Действия с пространством"
                      onClick={(event) => {
                        event.stopPropagation();
                        const rect = event.currentTarget.getBoundingClientRect();
                        openSubMenu(space, rect.right, rect.bottom);
                      }}
                    >
                      <MoreHorizontal size={15} />
                    </button>
                    <ChevronRight size={15} className="room-subspace__chevron" />
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
        {showUserResults && (
          <UserSearchSection
            users={userSearch.users}
            searching={userSearch.searching}
            onStartDm={handleStartDmWithUser}
          />
        )}
        {!isDmsView && (
          <RoomSection
            title="Избранное"
            icon={<Star size={14} />}
            rooms={visibleFavourites}
            open={openSections.favourites}
            onToggleOpen={() => setOpenSections((state) => ({ ...state, favourites: !state.favourites }))}
            activeRoomId={activeRoomId}
            collapsed={collapsed}
            onSelectRoom={onSelectRoom}
            onShowTip={showRoomTip}
            onHideTip={() => setTip(null)}
            onOpenRowMenu={openRowMenu}
            reorderable={!collapsed && !searchValue && isHomeView}
            onReorder={(rooms) => {
              setFavouriteOrderIds(rooms.map((room) => room.id));
              onReorderFavourites(rooms);
            }}
          />
        )}
        {!isDmsView && (
          <RoomSection
            title="Каналы"
            icon={<Hash size={14} />}
            rooms={visibleChannels}
            open={openSections.channels}
            onToggleOpen={() => setOpenSections((state) => ({ ...state, channels: !state.channels }))}
            activeRoomId={activeRoomId}
            collapsed={collapsed}
            onSelectRoom={onSelectRoom}
            onShowTip={showRoomTip}
            onHideTip={() => setTip(null)}
            onOpenRowMenu={openRowMenu}
            onAdd={!searchValue ? onCreateChannel : undefined}
            addLabel="Создать канал"
          />
        )}
        <RoomSection
          title="Личные сообщения"
          icon={<MessageCircle size={14} />}
          rooms={visibleDms}
          open={openSections.dms}
          onToggleOpen={() => setOpenSections((state) => ({ ...state, dms: !state.dms }))}
          activeRoomId={activeRoomId}
          collapsed={collapsed}
          onSelectRoom={onSelectRoom}
          onShowTip={showRoomTip}
          onHideTip={() => setTip(null)}
          onOpenRowMenu={openRowMenu}
          onAdd={canCreateDm ? onCreateDm : undefined}
          addLabel="Создать личный чат"
        />
      </div>

      {total === 0 && (
        <div className="room-list__empty">
          Комнат пока нет или sync ещё не принёс список.
        </div>
      )}
      {total > 0 && searchValue && !hasSearchResults && !userSearch.searching && (
        <div className="room-list__empty">Ничего не найдено.</div>
      )}
      {total > 0 && searchValue && userSearch.searching && !hasSearchResults && (
        <div className="room-list__empty room-list__empty--searching">
          <Loader2 size={16} className="room-list__searchSpinner" />
          <span>Ищем...</span>
        </div>
      )}
      <AnimatePresence>
        {tip && (
          <motion.div
            className="room-list__tip"
            style={{ left: tip.left, top: tip.top }}
            initial={{ opacity: 0, x: -4, y: "-50%" }}
            animate={{ opacity: 1, x: 0, y: "-50%" }}
            exit={{ opacity: 0, x: -4, y: "-50%" }}
            transition={transition.fast}
          >
            {tip.text}
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {rowMenu && (
          <motion.div
            ref={rowMenuRef}
            className="row-menu"
            style={{ left: rowMenu.x, top: rowMenu.y }}
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4 }}
            transition={transition.fast}
          >
            <button
              type="button"
              className="row-menu__item"
              onClick={() => {
                onOpenSettings(rowMenu.room.id);
                setRowMenu(null);
              }}
            >
              <Settings size={16} />
              <span>Настройки</span>
            </button>
            <button
              type="button"
              className="row-menu__item"
              onClick={() => {
                onToggleFavourite(rowMenu.room.id);
                setRowMenu(null);
              }}
            >
              <Star size={16} fill={rowMenu.room.favourite ? "currentColor" : "none"} />
              <span>{rowMenu.room.favourite ? "Убрать из избранного" : "В избранное"}</span>
            </button>
            <div className="row-menu__divider" />
            <button
              type="button"
              className="row-menu__item row-menu__item--danger"
              onClick={() => {
                onLeaveRoom(rowMenu.room.id);
                setRowMenu(null);
              }}
            >
              <LogOut size={16} />
              <span>{rowMenu.room.kind === "dm" ? "Покинуть чат" : "Покинуть канал"}</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {subMenu && (
          <motion.div
            ref={subMenuRef}
            className="row-menu"
            style={{ left: subMenu.x, top: subMenu.y }}
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4 }}
            transition={transition.fast}
          >
            <button
              type="button"
              className="row-menu__item"
              onClick={() => {
                onOpenSettings(subMenu.space.id);
                setSubMenu(null);
              }}
            >
              <Settings size={16} />
              <span>Настройки</span>
            </button>
            <div className="row-menu__divider" />
            <button
              type="button"
              className="row-menu__item row-menu__item--danger"
              onClick={() => {
                onLeaveRoom(subMenu.space.id);
                setSubMenu(null);
              }}
            >
              <LogOut size={16} />
              <span>Покинуть пространство</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </aside>
  );
});

type SectionProps = {
  title: string;
  icon: React.ReactNode;
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

function UserSearchSection({
  users,
  searching,
  onStartDm,
}: {
  users: UserDirectoryEntry[];
  searching: boolean;
  onStartDm: (userId: string) => void;
}) {
  if (searching && users.length === 0) {
    return (
      <section className="room-section room-section--search">
        <div className="room-section__head">
          <div className="room-section__title room-section__title--static">
            <span className="room-section__icon"><UserPlus size={14} /></span>
            <span>Люди</span>
          </div>
        </div>
        <div className="room-section__body is-open">
          <div className="room-section__body-inner">
            <div className="room-list__searchHint">
              <Loader2 size={16} className="room-list__searchSpinner" />
              <span>Ищем пользователей...</span>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (users.length === 0) return null;

  return (
    <section className="room-section room-section--search">
      <div className="room-section__head">
        <div className="room-section__title room-section__title--static">
          <span className="room-section__icon"><UserPlus size={14} /></span>
          <span>Люди</span>
        </div>
      </div>
      <div className="room-section__body is-open">
        <div className="room-section__body-inner">
          <div className="room-section__items">
            {users.map((entry) => {
              const label = entry.display_name || entry.user_id;
              return (
                <button
                  key={entry.user_id}
                  type="button"
                  className="sidebar-user-row"
                  onClick={() => onStartDm(entry.user_id)}
                >
                  <span
                    className="sidebar-user-row__avatar"
                    style={{ background: colorForId(entry.user_id) }}
                  >
                    {label.slice(0, 1).toUpperCase()}
                    {entry.avatar_url && (
                      <AuthedImage url={entry.avatar_url} className="sidebar-user-row__avatar-img" />
                    )}
                  </span>
                  <span className="sidebar-user-row__main">
                    <strong>{label}</strong>
                    {entry.display_name && <span>{entry.user_id}</span>}
                    {!entry.display_name && <span>Начать личный чат</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function RoomSection({
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

function reconcileRoomsByIds(
  next: MatrixRoomSummary[],
  previousIds: string[],
): MatrixRoomSummary[] {
  const nextById = new Map(next.map((room) => [room.id, room]));
  const kept = previousIds
    .map((id) => nextById.get(id))
    .filter((room): room is MatrixRoomSummary => Boolean(room));
  const keptIds = new Set(kept.map((room) => room.id));
  const added = next.filter((room) => !keptIds.has(room.id));
  return [...kept, ...added];
}
