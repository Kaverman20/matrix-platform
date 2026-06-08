import { BootScreen } from "./BootScreen";
import { useMatrix } from "./providers/MatrixContext";
import { LoginScreen } from "../features/auth/LoginScreen";

export function App() {
  const { status, client, userId, logout } = useMatrix();

  if (status === "anonymous" || status === "error") return <LoginScreen />;
  if (status === "connecting" || !client) return <BootScreen />;

  return (
    <main className="app-shell">
      <section className="welcome">
        <div className="welcome__mark">S</div>
        <h1>Surf Chat</h1>
        <p>{userId ? `Вы вошли как ${userId}` : "Matrix client is ready."}</p>
        <button className="welcome__button" onClick={() => void logout()}>
          Выйти
        </button>
      </section>
    </main>
  );
}
