import { useEffect, type ReactNode } from "react";
import { MotionConfig } from "framer-motion";
import { BootScreen } from "./BootScreen";
import { ChatShell } from "./ChatShell";
import { useLowPowerMode } from "./useLowPowerMode";
import { useMatrix } from "./providers/MatrixContext";
import { LoginScreen } from "../features/auth/LoginScreen";

export function App() {
  const { status, client } = useMatrix();
  const reduceMotion = useLowPowerMode();

  // Toggle a root class so CSS animations/transitions can be neutralised too
  // (framer's MotionConfig only covers motion components).
  useEffect(() => {
    document.documentElement.classList.toggle("reduce-motion", reduceMotion);
  }, [reduceMotion]);

  const screen: ReactNode =
    status === "anonymous" || status === "error" ? (
      <LoginScreen />
    ) : status === "connecting" || !client ? (
      <BootScreen />
    ) : (
      <ChatShell />
    );

  return (
    <MotionConfig reducedMotion={reduceMotion ? "always" : "user"}>{screen}</MotionConfig>
  );
}
