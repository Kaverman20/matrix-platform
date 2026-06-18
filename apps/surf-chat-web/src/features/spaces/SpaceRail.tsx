import { Home, MessageCircle, MessagesSquare, Plus } from "lucide-react";
import {
  formatUnreadCount,
  type MatrixSpaceSummary,
} from "@matrix-platform/matrix-core";
import type { SidebarView } from "../../app/chatUrl";
import { HelpMenu } from "../help/HelpMenu";
import { AuthedImage } from "../media/AuthedImage";
import "./space-rail.css";

type Props = {
  spaces: MatrixSpaceSummary[];
  spaceUnreads: Readonly<Record<string, number>>;
  spaceMentions: Readonly<Record<string, number>>;
  dmUnreads: number;
  dmMentions: number;
  sidebarView: SidebarView;
  activeSpaceId: string | null;
  onSelectHome: () => void;
  onSelectDms: () => void;
  onSelectSpace: (spaceId: string) => void;
  onCreateSpace: () => void;
  onOpenAllThreads: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
};

export function SpaceRail({
  spaces,
  spaceUnreads,
  spaceMentions,
  dmUnreads,
  dmMentions,
  sidebarView,
  activeSpaceId,
  onSelectHome,
  onSelectDms,
  onSelectSpace,
  onCreateSpace,
  onOpenAllThreads,
  onOpenSettings,
  onLogout,
}: Props) {
  const dmBadge = sidebarView !== "dms"
    ? railBadgeLabel(dmMentions, dmUnreads)
    : "";

  return (
    <nav className="space-rail">
      <button
        className={`space-rail__home${sidebarView === "home" ? " is-active" : ""}`}
        title="Все чаты"
        aria-label="Все чаты"
        onClick={onSelectHome}
      >
        {sidebarView === "home" && <span className="space-rail__indicator" />}
        <Home size={22} />
      </button>
      <button
        className={`space-rail__item space-rail__item--dms${sidebarView === "dms" ? " is-active" : ""}`}
        title={dmBadge ? `Личные сообщения (${dmBadge})` : "Личные сообщения"}
        aria-label="Личные сообщения"
        onClick={onSelectDms}
      >
        {sidebarView === "dms" && <span className="space-rail__indicator" />}
        <RailBadge mentions={dmMentions} unread={dmUnreads} active={sidebarView === "dms"} />
        <MessageCircle size={22} />
      </button>
      <div className="space-rail__spaces">
        {spaces.map((space) => (
          <SpaceRailItem
            key={space.id}
            space={space}
            unread={spaceUnreads[space.id] ?? 0}
            mentions={spaceMentions[space.id] ?? 0}
            active={sidebarView === "space" && activeSpaceId === space.id}
            onSelect={() => onSelectSpace(space.id)}
          />
        ))}
      </div>
      <div className="space-rail__bottom">
        <button
          className="space-rail__item space-rail__item--add"
          title="Создать пространство"
          onClick={onCreateSpace}
        >
          <Plus size={20} />
        </button>
        <button
          className="space-rail__item space-rail__item--add"
          title="Все треды"
          onClick={onOpenAllThreads}
        >
          <MessagesSquare size={20} />
        </button>
        <HelpMenu onOpenSettings={onOpenSettings} onLogout={onLogout} />
      </div>
    </nav>
  );
}

function SpaceRailItem({
  space,
  unread,
  mentions,
  active,
  onSelect,
}: {
  space: MatrixSpaceSummary;
  unread: number;
  mentions: number;
  active: boolean;
  onSelect: () => void;
}) {
  const badge = !active ? railBadgeLabel(mentions, unread) : "";

  return (
    <button
      className={`space-rail__item${active ? " is-active" : ""}`}
      style={{ background: space.color }}
      title={badge ? `${space.name} (${badge})` : space.name}
      aria-label={space.name}
      onClick={onSelect}
    >
      {active && <span className="space-rail__indicator" />}
      <RailBadge mentions={mentions} unread={unread} active={active} />
      {space.label}
      <AuthedImage url={space.avatarUrl} className="space-rail__avatar" />
    </button>
  );
}

function RailBadge({
  mentions,
  unread,
  active,
}: {
  mentions: number;
  unread: number;
  active: boolean;
}) {
  if (active) return null;

  if (mentions > 0) {
    return (
      <span className="space-rail__badge space-rail__badge--mention">
        {formatUnreadCount(mentions)}
      </span>
    );
  }

  if (unread > 0) {
    return <span className="space-rail__badge">{formatUnreadCount(unread)}</span>;
  }

  return null;
}

function railBadgeLabel(mentions: number, unread: number): string {
  if (mentions > 0) {
    return `${mentions} упоминаний`;
  }
  if (unread > 0) {
    return `${unread} непрочитанных`;
  }
  return "";
}
