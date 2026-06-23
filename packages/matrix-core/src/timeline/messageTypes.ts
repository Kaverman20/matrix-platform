export type MatrixMessage = {
  id: string;
  kind?: "message" | "system";
  sender: string;
  author: string;
  time: string;
  timestamp: number;
  text: string;
  /** HTML body from the Matrix event, when present. */
  formattedBody?: string;
  color: string;
  avatarUrl?: string;
  media?: MatrixMedia;
  /** Id альбома из кастомного поля события (для группировки соседних медиа). */
  albumId?: string;
  /** Несколько медиа, отправленных одним альбомом (как «пак» в Telegram).
      Когда задано — рендерим сеткой вместо одиночного `media`. */
  albumMedia?: MatrixMedia[];
  own: boolean;
  deliveryStatus?: MatrixDeliveryStatus;
  edited: boolean;
  deleted?: boolean;
  forwardedFrom?: string;
  reactions: MatrixReaction[];
  replyTo?: MatrixMessageReference;
  pinned?: boolean;
  thread?: MatrixThreadSummary;
  poll?: MatrixPoll;
};

export type MatrixDeliveryStatus = "sending" | "sent" | "read" | "error";

export type MatrixThreadSummary = {
  /** Number of replies in the thread (excludes the root message). */
  count: number;
  lastAuthor?: string;
  unread: boolean;
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
  waveform?: number[];
};

export type MatrixPollAnswer = {
  id: string;
  text: string;
};

export type MatrixPoll = {
  question: string;
  answers: MatrixPollAnswer[];
  maxSelections: number;
  kind: "disclosed" | "undisclosed";
  closed: boolean;
  mySelections: string[];
  voteCounts: Record<string, number>;
  totalVotes: number;
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
