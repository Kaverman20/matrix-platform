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
  /** All m.space.child targets (rooms and sub-spaces). */
  childIds: string[];
  /** Subset of childIds that are themselves spaces. */
  childSpaceIds: string[];
  /** True when this space is a child of another joined space. */
  nested: boolean;
};

export type MatrixRoomGroups = {
  spaces: MatrixSpaceSummary[];
  favourites: MatrixRoomSummary[];
  channels: MatrixRoomSummary[];
  dms: MatrixRoomSummary[];
};

