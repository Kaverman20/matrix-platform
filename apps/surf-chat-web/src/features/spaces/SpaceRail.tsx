import { LogOut, Plus } from "lucide-react";
import type { MatrixSpaceSummary } from "@matrix-platform/matrix-core";
import { useAuthedBlob } from "../media/useAuthedBlob";
import "./space-rail.css";

type Props = {
  spaces: MatrixSpaceSummary[];
  /** The currently active space id, or null for the "all chats" home. */
  activeSpaceId: string | null;
  onSelectHome: () => void;
  onSelectSpace: (spaceId: string) => void;
  onCreateSpace: () => void;
  onLogout: () => void;
};

export function SpaceRail({
  spaces,
  activeSpaceId,
  onSelectHome,
  onSelectSpace,
  onCreateSpace,
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
            active={activeSpaceId === space.id}
            onSelect={() => onSelectSpace(space.id)}
          />
        ))}
      </div>
      <button
        className="space-rail__item space-rail__item--add"
        title="Создать пространство"
        onClick={onCreateSpace}
      >
        <Plus size={20} />
      </button>
      <button className="space-rail__logout" title="Выйти" onClick={onLogout}>
        <LogOut size={18} />
      </button>
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
  // Space avatars live behind Synapse authenticated media, so a plain <img>
  // (no Authorization header) would 401. Fetch the blob with the access token.
  const { src } = useAuthedBlob(space.avatarUrl);

  return (
    <button
      className={`space-rail__item${active ? " is-active" : ""}`}
      style={{ background: space.color }}
      title={space.name}
      onClick={onSelect}
    >
      {active && <span className="space-rail__indicator" />}
      {space.label}
      {src && <img className="space-rail__avatar" src={src} alt="" />}
    </button>
  );
}
