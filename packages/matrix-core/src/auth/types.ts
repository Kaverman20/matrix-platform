import type { MatrixSession } from "../session/types";

export type LoginOptions = {
  deviceDisplayName?: string;
};

export type SsoIdentityProvider = {
  id: string;
  name: string;
};

export type LoginResult = MatrixSession;

