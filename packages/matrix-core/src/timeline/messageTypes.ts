export type MatrixMessage = {
  id: string;
  sender: string;
  author: string;
  time: string;
  timestamp: number;
  text: string;
  color: string;
  avatarUrl?: string;
  media?: MatrixMedia;
  own: boolean;
  edited: boolean;
  forwardedFrom?: string;
  reactions: MatrixReaction[];
  replyTo?: MatrixMessageReference;
  pinned?: boolean;
};

export type MatrixReaction = {
  key: string;
  count: number;
  mine: boolean;
  myEventId?: string;
  senders: string[];
};

export type MatrixMedia = {
  kind: "image" | "video" | "audio" | "file";
  url: string;
  thumbUrl?: string;
  name: string;
  mimetype?: string;
  size?: number;
  width?: number;
  height?: number;
  durationMs?: number;
  voice?: boolean;
};

export type MatrixMessageReference = {
  id: string;
  sender?: string;
  author?: string;
  text?: string;
};

export type MatrixForwardData = {
  content: Record<string, unknown>;
  author: string;
  sender: string;
  preview: string;
};
