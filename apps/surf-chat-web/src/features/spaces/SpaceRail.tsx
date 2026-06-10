import { LogOut, Plus } from "lucide-react";
import type { SyntheticEvent } from "react";
import type { MatrixSpaceSummary } from "@matrix-platform/matrix-core";
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
          <button
            key={space.id}
            className={`space-rail__item${activeSpaceId === space.id ? " is-active" : ""}`}
            style={{ background: space.color }}
            title={space.name}
            onClick={() => onSelectSpace(space.id)}
          >
            {activeSpaceId === space.id && <span className="space-rail__indicator" />}
            {space.label}
            {space.avatarUrl && (
              <img className="space-rail__avatar" src={space.avatarUrl} alt="" onError={hideImage} />
            )}
          </button>
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

function hideImage(event: SyntheticEvent<HTMLImageElement>): void {
  event.currentTarget.style.display = "none";
}
