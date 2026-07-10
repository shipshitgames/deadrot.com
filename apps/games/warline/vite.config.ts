import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  // Relative base keeps the static build usable behind the monorepo hub route.
  base: "./",
  publicDir: fileURLToPath(new URL("../../../packages/assets/masters/ui/brand/favicon", import.meta.url)),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    host: true,
    port: 5180,
  },
  build: {
    sourcemap: true,
  },
});
