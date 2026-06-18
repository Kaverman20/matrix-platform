import { RefreshCw, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { useMatrix } from "./providers/MatrixContext";

export function SyncErrorScreen() {
  const { error, retrySync, logout } = useMatrix();
  const [online, setOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const onRetry = async () => {
    if (retrying || !online) return;
    setRetrying(true);
    try {
      await retrySync();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <main className="app-shell">
      <section className="welcome sync-error" aria-live="polite">
        <div className="welcome__mark sync-error__mark">
          {online ? <RefreshCw size={28} /> : <WifiOff size={28} />}
        </div>
        <h1>Не удалось синхронизироваться</h1>
        <p>
          {online
            ? (error ?? "Сервер Matrix временно недоступен или соединение прервалось.")
            : "Нет подключения к интернету. Проверьте сеть и попробуйте снова."}
        </p>
        <div className="sync-error__actions">
          <button
            type="button"
            className="surf-btn surf-btn--primary"
            disabled={!online || retrying}
            onClick={() => void onRetry()}
          >
            {retrying ? "Подключаемся…" : "Повторить"}
          </button>
          <button type="button" className="surf-btn surf-btn--ghost" onClick={() => void logout()}>
            Выйти
          </button>
        </div>
      </section>
    </main>
  );
}
