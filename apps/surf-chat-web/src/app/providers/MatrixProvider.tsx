import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { MatrixClient } from "matrix-js-sdk";
import {
  DEFAULT_SSO_HOMESERVER_STORAGE_KEY,
  buildSsoRedirectUrl,
  clearMatrixSession,
  enableEncryption,
  loadMatrixSession,
  loginWithAccessToken,
  loginWithLoginToken,
  loginWithPassword,
  saveMatrixSession,
  setupDirectInviteAutoJoin,
  startMatrixClient,
  subscribeSessionLogout,
  subscribeSyncState,
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
  const clientRef = useRef<MatrixClient | null>(null);

  useEffect(() => {
    clientRef.current = client;
  }, [client]);

  const resetToLogin = useCallback((message?: string) => {
    clearMatrixSession(window.localStorage);
    clientRef.current?.stopClient();
    setClient(null);
    setError(message ?? null);
    setStatus("anonymous");
  }, []);

  const boot = useCallback(
    async (session: MatrixSession) => {
      setStatus("connecting");
      setError(null);

      try {
        const nextClient = await startMatrixClient(session);

        void enableEncryption(nextClient).catch((e) => {
          console.error("[matrix] enableEncryption failed", e);
        });

        subscribeSyncState(nextClient, {
          onReady: () => setStatus("ready"),
          onError: () => {
            setError("Не удалось синхронизироваться с сервером");
            setStatus("sync_error");
          },
        });
        subscribeSessionLogout(nextClient, () => {
          resetToLogin("Сессия истекла — войдите заново");
        });
        setupDirectInviteAutoJoin(nextClient);

        setClient(nextClient);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setStatus("sync_error");
      }
    },
    [resetToLogin],
  );

  // Завершение SSO-входа по loginToken — общая логика для веба (токен в URL) и
  // десктопа (токен приходит из системного браузера через loopback-колбэк).
  const completeSsoLogin = useCallback(
    async (loginToken: string) => {
      const homeserver =
        window.localStorage.getItem(DEFAULT_SSO_HOMESERVER_STORAGE_KEY) ??
        DEFAULT_HOMESERVER;
      setStatus("connecting");
      setError(null);
      try {
        const session = await loginWithLoginToken(homeserver, loginToken);
        saveMatrixSession(window.localStorage, session);
        await boot(session);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setStatus("anonymous");
      }
    },
    [boot],
  );

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    void (async () => {
      const params = new URLSearchParams(window.location.search);
      const loginToken = params.get("loginToken");

      if (loginToken) {
        params.delete("loginToken");
        const search = params.toString();
        window.history.replaceState(
          {},
          document.title,
          `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`,
        );
        await completeSsoLogin(loginToken);
        return;
      }

      const savedSession = loadMatrixSession(window.localStorage);
      if (savedSession) await boot(savedSession);
    })();
  }, [boot, completeSsoLogin]);

  // Десктоп: SSO-токен возвращается не в URL, а через мост из main-процесса
  // (системный браузер → loopback http://127.0.0.1 → IPC).
  useEffect(() => {
    const bridge = window.surfDesktop;
    if (!bridge) return;
    return bridge.onSsoCallback(({ loginToken }) => {
      void completeSsoLogin(loginToken);
    });
  }, [completeSsoLogin]);

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
      const bridge = window.surfDesktop;
      if (bridge) {
        // Десктоп: redirectUrl — loopback http://127.0.0.1 со state (его выдаёт
        // main), логин открываем в системном браузере, токен вернётся в main.
        const redirectUrl = await bridge.beginSso();
        const url = await buildSsoRedirectUrl(homeserver, idpId, redirectUrl);
        await bridge.openSso(url);
      } else {
        // Веб: возврат на свой origin, навигация в том же окне.
        const redirectUrl = `${window.location.origin}/`;
        const url = await buildSsoRedirectUrl(homeserver, idpId, redirectUrl);
        window.location.assign(url);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("anonymous");
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await clientRef.current?.logout(true);
    } catch {
      // Local logout still wins if the server request fails.
    }
    resetToLogin();
  }, [resetToLogin]);

  const retrySync = useCallback(async () => {
    const session = loadMatrixSession(window.localStorage);
    if (!session) {
      resetToLogin();
      return;
    }

    clientRef.current?.stopClient();
    setClient(null);
    await boot(session);
  }, [boot, resetToLogin]);

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
      retrySync,
    }),
    [client, error, loginAccessToken, loginPassword, loginSso, logout, retrySync, status],
  );

  return <MatrixContext.Provider value={value}>{children}</MatrixContext.Provider>;
}
