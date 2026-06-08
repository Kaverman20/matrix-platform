export type MatrixSession = {
  baseUrl: string;
  accessToken: string;
  userId: string;
  deviceId: string;
};

export type SessionStorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

