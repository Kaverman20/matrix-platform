import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Boxes, ChevronDown, ChevronLeft, ChevronRight, Hash, Loader2, LogOut, MessageCircle, MoreHorizontal, PanelLeftClose, PanelLeftOpen, Plus, Search, Settings, Star } from "lucide-react";
import type { MatrixRoomSummary, MatrixSpaceSummary } from "@matrix-platform/matrix-core";
import { filterRoomSummaries } from "@matrix-platform/matrix-core";
import { transition } from "@matrix-platform/ui";
import type { SidebarView } from "../../app/chatUrl";
import { useMatrix } from "../../app/providers/MatrixContext";
import { AuthedImage } from "../../components/AuthedImage";
import { useSidebarUserSearch } from "./useSidebarUserSearch";
import { RoomSection } from "./RoomSection";
import { UserSearchSection } from "./UserSearchSection";
import { reconcileRoomsByIds } from "./reconcileRoomsByIds";
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