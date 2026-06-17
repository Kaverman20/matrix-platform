import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
};

type State = {
  error: Error | null;
};

/**
 * Top-level safety net: catches render-time crashes so a single broken event /
 * component doesn't blank the whole app. Offers a reload instead of a white
 * screen. (Async errors still need local try/catch — boundaries only catch
 * errors thrown during render.)
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[app] render error", error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;

    return (
      <main className="app-shell">
        <section className="welcome" role="alert">
          <h1>Что-то пошло не так</h1>
          <p>Приложение столкнулось с ошибкой. Попробуйте перезагрузить страницу.</p>
          <button type="button" className="surf-btn surf-btn--primary" onClick={() => window.location.reload()}>
            Перезагрузить
          </button>
        </section>
      </main>
    );
  }
}
