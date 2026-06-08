import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { MatrixProvider } from "./app/providers/MatrixProvider";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MatrixProvider>
      <App />
    </MatrixProvider>
  </StrictMode>,
);
