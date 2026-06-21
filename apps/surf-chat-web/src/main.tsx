import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { ErrorBoundary } from "./app/ErrorBoundary";
import { MatrixProvider } from "./app/providers/MatrixProvider";
import { PreferencesProvider } from "./app/providers/PreferencesProvider";
import { initThemeFromStorage } from "./app/providers/usePreferences";
import "./styles/index.css";
import "./styles/tokens-presets.css";

// Apply the saved theme before first paint to avoid a light→dark flash.
initThemeFromStorage();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <PreferencesProvider>
        <MatrixProvider>
          <App />
        </MatrixProvider>
      </PreferencesProvider>
    </ErrorBoundary>
  </StrictMode>,
);
