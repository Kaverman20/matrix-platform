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
  replyTo?: MatrixMessageReference;
};

export type MatrixMessageReference = {
  id: string;
  sender?: string;
  author?: string;
  text?: string;
};
