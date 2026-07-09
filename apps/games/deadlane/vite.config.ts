import react from "@vitejs/plugin-react";
import { createDeadrotViteConfig } from "../vite.config";

export default createDeadrotViteConfig("deadlane", [react()]);
