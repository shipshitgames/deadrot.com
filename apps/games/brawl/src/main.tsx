import { createRoot } from "react-dom/client";
import { App } from "./App";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Brawl: #root not found in DOM.");
}

createRoot(root).render(<App />);
