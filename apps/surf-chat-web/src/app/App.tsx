import { useEffect, type ReactNode } from "react";
import { MotionConfig } from "framer-motion";
import { BootScreen } from "./BootScreen";
import { ChatShell } from "./ChatShell";
import { SyncErrorScreen } from "./SyncErrorScreen";
import { VersionUpdateBanner } from "./VersionUpdateBanner";
import { useLowPowerMode } from "./useLowPowerMode";
import { useMatrix } from "./providers/MatrixContext";
import { useVersionUpdate } from "./useVersionUpdate";
import { LoginScreen } from "../features/auth/LoginScreen";

export function App() {
  const { status, client } = useMatrix();
  const reduceMotion = useLowPowerMode();
  const versionUpdate = useVersionUpdate(status === "ready" && Boolean(client));

  useEffect(() => {
    document.documentElement.classList.toggle("reduce-motion", reduceMotion);
  }, [reduceMotion]);

  const screen: ReactNode =
    status === "sync_error" ? (
      <SyncErrorScreen />
    ) : status === "anonymous" ? (
      <LoginScreen />
    ) : status === "connecting" || !client ? (
      <BootScreen />
    ) : (
      <ChatShell />
    );

  return (
    <MotionConfig reducedMotion={reduceMotion ? "always" : "user"}>
      {screen}
      <VersionUpdateBanner
        visible={versionUpdate.updateAvailable}
        onReload={versionUpdate.reload}
        onDismiss={versionUpdate.dismiss}
      />
    </MotionConfig>
  );
}
