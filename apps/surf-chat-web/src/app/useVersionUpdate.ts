import { useCallback, useEffect, useState } from "react";
import { BUILD_ID_PATH, fetchRemoteBuildId, isRemoteBuildNewer } from "./versionUpdate";

const CHECK_INTERVAL_MS = 5 * 60 * 1000;

export function useVersionUpdate(enabled: boolean) {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  const checkForUpdate = useCallback(async () => {
    if (!enabled || import.meta.env.DEV) return;

    const remoteBuildId = await fetchRemoteBuildId(BUILD_ID_PATH);
    if (!remoteBuildId) return;

    if (isRemoteBuildNewer(remoteBuildId, __APP_BUILD_ID__)) {
      setUpdateAvailable(true);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled || import.meta.env.DEV) return;

    const timer = window.setTimeout(() => {
      void checkForUpdate();
    }, 0);

    const interval = window.setInterval(() => {
      void checkForUpdate();
    }, CHECK_INTERVAL_MS);

    const onFocus = () => {
      void checkForUpdate();
    };

    window.addEventListener("focus", onFocus);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [checkForUpdate, enabled]);

  const reload = useCallback(() => {
    window.location.reload();
  }, []);

  const dismiss = useCallback(() => {
    setUpdateAvailable(false);
  }, []);

  return {
    updateAvailable,
    reload,
    dismiss,
    checkForUpdate,
  };
}
