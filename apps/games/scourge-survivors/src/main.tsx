import { initDeadrotBrowserTelemetry } from "@deadrot/game-kit/telemetry/browser";
import ReactDOM from "react-dom/client";
import App from "./App";
import "@shipshitgames/ui/styles.css";
import "./styles.css";

void initDeadrotBrowserTelemetry({ game: "scourge-survivors", env: import.meta.env });

// Intentionally NOT wrapped in <React.StrictMode>: Strict mode double-invokes
// effects in dev, which would spin up two WebGL contexts / game loops.
ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
