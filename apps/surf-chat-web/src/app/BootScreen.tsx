import { MessageSquare } from "lucide-react";

export function BootScreen() {
  return (
    <main className="app-shell">
      <section className="welcome" aria-live="polite">
        <div className="welcome__mark">
          <MessageSquare size={28} />
        </div>
        <h1>Surf Chat</h1>
        <p>Подключаемся к Matrix...</p>
      </section>
    </main>
  );
}

