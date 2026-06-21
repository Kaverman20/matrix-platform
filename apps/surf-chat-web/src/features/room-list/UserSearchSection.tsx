import { Loader2, UserPlus } from "lucide-react";
import type { UserDirectoryEntry } from "@matrix-platform/matrix-core";
import { colorForId } from "@matrix-platform/matrix-core";
import { AuthedImage } from "../../components/AuthedImage";

export function UserSearchSection({
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
