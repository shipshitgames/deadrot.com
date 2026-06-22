import { initDeadrotBrowserTelemetry } from "@deadrot/game-kit/telemetry/browser";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "@shipshitgames/ui/styles.css";
import "./styles.css";

void initDeadrotBrowserTelemetry({ game: "warline", env: import.meta.env });

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
