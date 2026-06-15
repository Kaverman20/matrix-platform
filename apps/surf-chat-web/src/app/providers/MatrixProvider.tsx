import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ClientEvent, HttpApiEvent, SyncState, type MatrixClient, type Room } from "matrix-js-sdk";
import {
  DEFAULT_SSO_HOMESERVER_STORAGE_KEY,
  buildSsoRedirectUrl,
  clearMatrixSession,
  loadMatrixSession,
  loginWithAccessToken,
  loginWithLoginToken,
  loginWithPassword,
  saveMatrixSession,
  startMatrixClient,
  type MatrixSession,
} from "@matrix-platform/matrix-core";
import { DEFAULT_HOMESERVER } from "../config";
import { MatrixContext, type MatrixStatus } from "./MatrixContext";

type Props = {
  children: ReactNode;
};

export function MatrixProvider({ children }: Props) {
  const [client, setClient] = useState<MatrixClient | null>(null);
  const [status, setStatus] = useState<MatrixStatus>("anonymous");
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  const resetToLogin = useCallback((message?: string) => {
    clearMatrixSession(window.localStorage);
    setClient((current) => {
      current?.stopClient();
      return null;
    });
    setError(message ?? null);
    setStatus("anonymous");
  }, []);

  const boot = useCallback(
    async (session: MatrixSession) => {
      setStatus("connecting");
      setError(null);

      try {
        const nextClient = await startMatrixClient(session);

        const onSync = (state: SyncState) => {
          if (state === SyncState.Prepared || state === SyncState.Syncing) {
            setStatus("ready");
            // Once we're ready we no longer need to track sync for the initial
            // boot — drop the listener so it doesn't pile up across re-logins.
            nextClient.off(ClientEvent.Sync, onSync);
          } else if (state === SyncState.Error) {
            // First sync failed (bad network / invalid token without a logout
            // signal) — surface it instead of hanging on the boot screen.
            setError("Не удалось синхронизироваться с сервером");
            setStatus("error");
            nextClient.off(ClientEvent.Sync, onSync);
          }
        };

        nextClient.on(ClientEvent.Sync, onSync);
        nextClient.on(HttpApiEvent.SessionLoggedOut, () => {
          resetToLogin("Сессия истекла - войдите заново");
        });
        setupDirectInviteAutoJoin(nextClient);

        const syncState = nextClient.getSyncState();
        if (syncState === SyncState.Prepared || syncState === SyncState.Syncing) {
          setStatus("ready");
          nextClient.off(ClientEvent.Sync, onSync);
        }

        setClient(nextClient);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setStatus("error");
      }
    },
    [resetToLogin],
  );

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    void (async () => {
      const params = new URLSearchParams(window.location.search);
      const loginToken = params.get("loginToken");

      if (loginToken) {
        window.history.replaceState({}, document.title, window.location.pathname);
        const homeserver =
          window.localStorage.getItem(DEFAULT_SSO_HOMESERVER_STORAGE_KEY) ??
          DEFAULT_HOMESERVER;

        try {
          const session = await loginWithLoginToken(homeserver, loginToken);
          saveMatrixSession(window.localStorage, session);
          await boot(session);
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
          setStatus("anonymous");
        }
        return;
      }

      const savedSession = loadMatrixSession(window.localStorage);
      if (savedSession) await boot(savedSession);
    })();
  }, [boot]);

  const loginPassword = useCallback(
    async (homeserver: string, user: string, password: string) => {
      setStatus("connecting");
      setError(null);
      try {
        const session = await loginWithPassword(homeserver, user, password);
        saveMatrixSession(window.localStorage, session);
        await boot(session);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setStatus("anonymous");
      }
    },
    [boot],
  );

  const loginAccessToken = useCallback(
    async (homeserver: string, accessToken: string) => {
      setStatus("connecting");
      setError(null);
      try {
        const session = await loginWithAccessToken(homeserver, accessToken);
        saveMatrixSession(window.localStorage, session);
        await boot(session);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setStatus("anonymous");
      }
    },
    [boot],
  );

  const loginSso = useCallback(async (homeserver: string, idpId: string | null) => {
    try {
      window.localStorage.setItem(DEFAULT_SSO_HOMESERVER_STORAGE_KEY, homeserver);
      const redirectUrl = `${window.location.origin}/`;
      const url = await buildSsoRedirectUrl(homeserver, idpId, redirectUrl);
      window.location.assign(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("anonymous");
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await client?.logout(true);
    } catch {
      // Local logout still wins if the server request fails.
    }
    resetToLogin();
  }, [client, resetToLogin]);

  const value = useMemo(
    () => ({
      client,
      status,
      error,
      userId: client?.getUserId() ?? null,
      defaultHomeserver: DEFAULT_HOMESERVER,
      loginPassword,
      loginAccessToken,
      loginSso,
      logout,
    }),
    [client, error, loginAccessToken, loginPassword, loginSso, logout, status],
  );

  return <MatrixContext.Provider value={value}>{children}</MatrixContext.Provider>;
}

function setupDirectInviteAutoJoin(client: MatrixClient): void {
  const joining = new Set<string>();

  const tryJoin = (room: Room) => {
    const inviter = room.getDMInviter();
    if (room.getMyMembership() !== "invite" || !inviter || joining.has(room.roomId)) return;

    joining.add(room.roomId);
    void client
      .joinRoom(room.roomId)
      .then(() => ensureDirectRoomAccountData(client, inviter, room.roomId))
      .catch((error) => {
        console.error("[dm-auto-join]", error);
      })
      .finally(() => {
        joining.delete(room.roomId);
      });
  };

  client.getRooms().forEach(tryJoin);
  client.on(ClientEvent.Room, tryJoin);
}

async function ensureDirectRoomAccountData(
  client: MatrixClient,
  targetUserId: string,
  roomId: string,
): Promise<void> {
  const content = {
    ...((client.getAccountData("m.direct" as never)?.getContent() ?? {}) as Record<string, string[]>),
  };
  const roomIds = new Set(content[targetUserId] ?? []);
  roomIds.add(roomId);
  content[targetUserId] = Array.from(roomIds);
  await client.setAccountData("m.direct" as never, content as never);
}
