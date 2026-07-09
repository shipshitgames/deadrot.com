import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { createDeadrotViteConfig } from "../vite.config";

export default createDeadrotViteConfig("scourge-survivors", [react(), tailwindcss()]);
