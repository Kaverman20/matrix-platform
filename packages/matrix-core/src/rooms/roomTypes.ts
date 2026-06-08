export type MatrixRoomKind = "channel" | "dm";

export type MatrixRoomSummary = {
  id: string;
  name: string;
  preview: string;
  time: string;
  timestamp: number;
  color: string;
  avatarUrl?: string;
  unread: number;
  kind: MatrixRoomKind;
  favourite: boolean;
  favouriteOrder: number;
  memberCount: number;
  topic: string;
};

export type MatrixSpaceSummary = {
  id: string;
  name: string;
  label: string;
  color: string;
  avatarUrl?: string;
  childIds: string[];
};

export type MatrixRoomGroups = {
  spaces: MatrixSpaceSummary[];
  favourites: MatrixRoomSummary[];
  channels: MatrixRoomSummary[];
  dms: MatrixRoomSummary[];
};

