import { BootScreen } from "./BootScreen";
import { ChatShell } from "./ChatShell";
import { useMatrix } from "./providers/MatrixContext";
import { LoginScreen } from "../features/auth/LoginScreen";

export function App() {
  const { status, client } = useMatrix();

  if (status === "anonymous" || status === "error") return <LoginScreen />;
  if (status === "connecting" || !client) return <BootScreen />;

  return <ChatShell />;
}
