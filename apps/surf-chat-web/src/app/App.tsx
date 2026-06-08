import { MessageSquare } from "lucide-react";

export function App() {
  return (
    <main className="app-shell">
      <section className="welcome">
        <div className="welcome__mark">
          <MessageSquare size={28} />
        </div>
        <h1>Surf Chat</h1>
        <p>Clean Matrix platform workspace is ready.</p>
      </section>
    </main>
  );
}

