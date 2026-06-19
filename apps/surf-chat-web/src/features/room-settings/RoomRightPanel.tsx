import { useState } from "react";
import { ArrowLeft, Bell, ChevronRight, FileText, Hash, Pin, Settings, UserPlus, Users, UserX } from "lucide-react";
import type { SyntheticEvent } from "react";
import type { MatrixMedia, MatrixRoomSummary, RoomMemberPermissions } from "@matrix-platform/matrix-core";

export type RightPanelSection = "overview" | "members" | "media" | "notifications" | "pinned";

type RoomMember = {
  id: string;
  name: string;
  userId: string;
  avatarUrl?: string;
  color: string;
  me: boolean;
};

type RoomMediaItem = {
  id: string;
  media: MatrixMedia;
  author: string;
  time: string;
};

type PinnedPreview = {
  id: string;
  author: string;
  text?: string | null;
};

type Props = {
  room: MatrixRoomSummary;
  section: RightPanelSection;
  onSectionChange: (section: RightPanelSection) => void;
  members: RoomMember[];
  media: RoomMediaItem[];
  pinned: PinnedPreview[];
  permissions: RoomMemberPermissions;
  canKickMember: (userId: string) => boolean;
  onOpenSettings: () => void;
  onOpenImage: (src: string) => void;
  onInviteUser: (userId: string) => Promise<void>;
  onKickMember: (userId: string) => Promise<void>;
  onJumpToPinned: (messageId: string) => void;
};

/** Contents of the room info / right panel (overview, members, media,
 * notifications). The animated `motion.aside` shell lives in ChatShell. */
export function RoomRightPanel({
  room,
  section,
  onSectionChange,
  members,
  media,
  pinned,
  permissions,
  canKickMember,
  onOpenSettings,
  onOpenImage,
  onInviteUser,
  onKickMember,
  onJumpToPinned,
}: Props) {
  const [inviteValue, setInviteValue] = useState("");
  const [invitePending, setInvitePending] = useState(false);
  const [kickPending, setKickPending] = useState<string | null>(null);

  const submitInvite = async () => {
    const userId = inviteValue.trim();
    if (!userId || invitePending) return;
    setInvitePending(true);
    try {
      await onInviteUser(userId);
      setInviteValue("");
    } finally {
      setInvitePending(false);
    }
  };

  const handleKick = async (userId: string, name: string) => {
    if (kickPending || !window.confirm(`Исключить ${name} из комнаты?`)) return;
    setKickPending(userId);
    try {
      await onKickMember(userId);
    } finally {
      setKickPending(null);
    }
  };

  return (
    <>
      <div className="right-panel__avatar" style={{ background: room.color }}>
        {room.avatarUrl ? (
          <img className="right-panel__avatar-img" src={room.avatarUrl} alt="" onError={hideImage} />
        ) : null}
        <span className="right-panel__avatar-fallback">
          {room.kind === "channel" ? <Hash size={34} /> : room.name.slice(0, 1).toUpperCase()}
        </span>
      </div>
      <strong className="right-panel__name">{room.name}</strong>
      <span className="right-panel__sub">
        {room.kind === "channel" ? "Канал" : "Личный чат"} · {membersLabel(room.memberCount)}
      </span>
      {room.topic && <div className="right-panel__topic">{room.topic}</div>}

      {section === "overview" ? (
        <div className="right-panel__rows">
          <button type="button" className="right-panel__row" onClick={onOpenSettings}>
            <Settings size={18} />
            <span>Настройки</span>
            <ChevronRight size={16} />
          </button>
          <button type="button" className="right-panel__row" onClick={() => onSectionChange("members")}>
            <Users size={18} />
            <span>Участники</span>
            <em>{members.length}</em>
            <ChevronRight size={16} />
          </button>
          <button type="button" className="right-panel__row" onClick={() => onSectionChange("pinned")}>
            <Pin size={18} />
            <span>Закреплённые</span>
            <em>{pinned.length}</em>
            <ChevronRight size={16} />
          </button>
          <button type="button" className="right-panel__row" onClick={() => onSectionChange("media")}>
            <FileText size={18} />
            <span>Файлы и медиа</span>
            <em>{media.length}</em>
            <ChevronRight size={16} />
          </button>
          <button
            type="button"
            className="right-panel__row"
            onClick={() => onSectionChange("notifications")}
          >
            <Bell size={18} />
            <span>Уведомления и права</span>
            <em>{room.unread > 0 ? room.unread : "По умолчанию"}</em>
            <ChevronRight size={16} />
          </button>
        </div>
      ) : (
        <>
          <div className="right-panel__section-head">
            <button
              type="button"
              className="right-panel__back"
              onClick={() => onSectionChange("overview")}
            >
              <ArrowLeft size={16} />
            </button>
            <strong className="right-panel__section-title">
              {section === "members"
                ? "Участники"
                : section === "pinned"
                  ? "Закреплённые"
                  : section === "media"
                    ? "Файлы и медиа"
                    : "Уведомления и права"}
            </strong>
          </div>

          {section === "members" ? (
            <>
              {permissions.canInvite && (
                <form
                  className="right-panel__invite"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void submitInvite();
                  }}
                >
                  <UserPlus size={16} />
                  <input
                    className="right-panel__invite-input"
                    placeholder="@user:server"
                    value={inviteValue}
                    disabled={invitePending}
                    onChange={(event) => setInviteValue(event.target.value)}
                  />
                  <button type="submit" className="right-panel__invite-btn" disabled={invitePending || !inviteValue.trim()}>
                    {invitePending ? "..." : "Пригласить"}
                  </button>
                </form>
              )}
              <div className="right-panel__list">
                {members.map((member) => (
                  <div key={member.id} className="right-panel__member">
                    <div className="right-panel__member-avatar" style={{ background: member.color }}>
                      {member.avatarUrl ? (
                        <img
                          className="right-panel__member-avatar-img"
                          src={member.avatarUrl}
                          alt=""
                          onError={hideImage}
                        />
                      ) : null}
                      <span className="right-panel__member-avatar-fallback">
                        {(member.name[0] || "?").toUpperCase()}
                      </span>
                    </div>
                    <div className="right-panel__member-body">
                      <strong>{member.name}</strong>
                      <span>{member.me ? "Вы" : member.userId}</span>
                    </div>
                    {!member.me && canKickMember(member.userId) && (
                      <button
                        type="button"
                        className="right-panel__kick"
                        title="Исключить"
                        disabled={kickPending === member.userId}
                        onClick={() => void handleKick(member.userId, member.name)}
                      >
                        <UserX size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : section === "pinned" ? (
            pinned.length > 0 ? (
              <div className="right-panel__list">
                {pinned.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="right-panel__pinned"
                    onClick={() => onJumpToPinned(item.id)}
                  >
                    <Pin size={15} />
                    <div className="right-panel__pinned-body">
                      <strong>{item.author}</strong>
                      <span>{item.text ?? "Сообщение"}</span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="right-panel__empty">
                <Pin size={18} />
                <span>Закреплённых сообщений пока нет.</span>
              </div>
            )
          ) : section === "media" ? (
            media.length > 0 ? (
              <div className="right-panel__list">
                {media.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="right-panel__media"
                    onClick={() => item.media.kind === "image" && onOpenImage(item.media.url)}
                  >
                    <div className="right-panel__media-preview">
                      {item.media.kind === "image" && item.media.thumbUrl ? (
                        <img src={item.media.thumbUrl} alt="" />
                      ) : (
                        <span>{mediaKindLabel(item.media.kind)}</span>
                      )}
                    </div>
                    <div className="right-panel__media-body">
                      <strong>{item.media.name}</strong>
                      <span>
                        {item.author} · {item.time}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="right-panel__empty">
                <FileText size={18} />
                <span>В этой комнате пока нет файлов и медиа.</span>
              </div>
            )
          ) : (
            <div className="right-panel__cards">
              <div className="right-panel__card">
                <span>Режим комнаты</span>
                <strong>По умолчанию</strong>
              </div>
              <div className="right-panel__card">
                <span>Непрочитанные</span>
                <strong>{room.unread}</strong>
              </div>
              <div className="right-panel__card">
                <span>Избранное</span>
                <strong>{room.favourite ? "Да" : "Нет"}</strong>
              </div>
              <div className="right-panel__card">
                <span>Ваш уровень прав</span>
                <strong>{permissions.myPowerLevel}</strong>
              </div>
              <div className="right-panel__card">
                <span>Приглашать</span>
                <strong>{permissions.canInvite ? "Да" : "Нет"}</strong>
              </div>
              <div className="right-panel__card">
                <span>Исключать</span>
                <strong>{permissions.canKick ? "Да" : "Нет"}</strong>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}

function membersLabel(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} участник`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} участника`;
  return `${count} участников`;
}

function mediaKindLabel(kind: MatrixMedia["kind"]): string {
  switch (kind) {
    case "image":
      return "IMG";
    case "video":
      return "VID";
    case "audio":
      return "AUD";
    default:
      return "FILE";
  }
}

function hideImage(event: SyntheticEvent<HTMLImageElement>): void {
  event.currentTarget.style.display = "none";
}
