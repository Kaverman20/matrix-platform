import { MessagesSquare, Plus } from "lucide-react";
import type { MatrixSpaceSummary } from "@matrix-platform/matrix-core";
import { AuthedImage } from "../media/AuthedImage";
import "./space-rail.css";

type Props = {
  spaces: MatrixSpaceSummary[];
  /** The currently active space id, or null for the "all chats" home. */
  activeSpaceId: string | null;
  onSelectHome: () => void;
  onSelectSpace: (spaceId: string) => void;
  onCreateSpace: () => void;
  onOpenAllThreads: () => void;
  onOpenAccount: () => void;
  account: {
    displayName: string;
    userId: string;
    avatarUrl?: string;
  } | null;
};

export function SpaceRail({
  spaces,
  activeSpaceId,
  onSelectHome,
  onSelectSpace,
  onCreateSpace,
  onOpenAllThreads,
  onOpenAccount,
  account,
}: Props) {
  const accountLabel = account?.displayName || account?.userId || "Профиль";

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
        <button className="space-rail__account" title={accountLabel} onClick={onOpenAccount}>
          <span>{accountLabel.slice(0, 1).toUpperCase()}</span>
          <AuthedImage url={account?.avatarUrl} className="space-rail__avatar" />
        </button>
      </div>
    </nav>
  );
}

function SpaceRailItem({
  space,
  active,
  onSelect,
}: {
  space: MatrixSpaceSummary;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      className={`space-rail__item${active ? " is-active" : ""}`}
      style={{ background: space.color }}
      title={space.name}
      onClick={onSelect}
    >
      {active && <span className="space-rail__indicator" />}
      {space.label}
      <AuthedImage url={space.avatarUrl} className="space-rail__avatar" />
    </button>
  );
}
