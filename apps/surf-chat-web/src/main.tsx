import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { ErrorBoundary } from "./app/ErrorBoundary";
import { MatrixProvider } from "./app/providers/MatrixProvider";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <MatrixProvider>
        <App />
      </MatrixProvider>
    </ErrorBoundary>
  </StrictMode>,
);
