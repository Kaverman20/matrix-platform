export type MatrixMessage = {
  id: string;
  sender: string;
  author: string;
  time: string;
  timestamp: number;
  text: string;
  color: string;
  avatarUrl?: string;
  own: boolean;
  edited: boolean;
  forwardedFrom?: string;
  replyTo?: MatrixMessageReference;
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
