import ReactDOM from "react-dom/client";
import App from "./App";
import "@shipshitgames/ui/styles.css";
import "./styles.css";

// Intentionally NOT wrapped in <React.StrictMode>: Strict mode double-invokes
// effects in dev, which would spin up two WebGL contexts / game loops.
ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
