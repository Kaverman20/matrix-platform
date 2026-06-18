import { MessagesSquare, Plus } from "lucide-react";
import { formatUnreadCount, type MatrixSpaceSummary } from "@matrix-platform/matrix-core";
import { HelpMenu } from "../help/HelpMenu";
import { AuthedImage } from "../media/AuthedImage";
import "./space-rail.css";

type Props = {
  spaces: MatrixSpaceSummary[];
  spaceUnreads: Readonly<Record<string, number>>;
  /** The currently active space id, or null for the "all chats" home. */
  activeSpaceId: string | null;
  onSelectHome: () => void;
  onSelectSpace: (spaceId: string) => void;
  onCreateSpace: () => void;
  onOpenAllThreads: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
};

export function SpaceRail({
  spaces,
  spaceUnreads,
  activeSpaceId,
  onSelectHome,
  onSelectSpace,
  onCreateSpace,
  onOpenAllThreads,
  onOpenSettings,
  onLogout,
}: Props) {
  return (
    <nav className="space-rail">
      <button
        className={`space-rail__home${activeSpaceId === null ? " is-active" : ""}`}
        title="Все чаты"
        onClick={onSelectHome}
      >
        {activeSpaceId === null && <span className="space-rail__indicator" />}
        S
      </button>
      <div className="space-rail__spaces">
        {spaces.map((space) => (
          <SpaceRailItem
            key={space.id}
            space={space}
            unread={spaceUnreads[space.id] ?? 0}
            active={activeSpaceId === space.id}
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
  active,
  onSelect,
}: {
  space: MatrixSpaceSummary;
  unread: number;
  active: boolean;
  onSelect: () => void;
}) {
  const badge = !active && unread > 0 ? formatUnreadCount(unread) : "";

  return (
    <button
      className={`space-rail__item${active ? " is-active" : ""}`}
      style={{ background: space.color }}
      title={badge ? `${space.name} (${unread} непрочитанных)` : space.name}
      onClick={onSelect}
    >
      {active && <span className="space-rail__indicator" />}
      {badge && <span className="space-rail__badge">{badge}</span>}
      {space.label}
      <AuthedImage url={space.avatarUrl} className="space-rail__avatar" />
    </button>
  );
}
