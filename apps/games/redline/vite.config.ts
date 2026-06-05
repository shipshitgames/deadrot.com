import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Relative base keeps the static build usable behind the monorepo hub route.
export default defineConfig({
  plugins: [react()],
  base: "./",
  resolve: {
    // Dedupe React + three so @shipshitgames/ui (react peer) doesn't pull a
    // second copy into the prod bundle (avoids runtime React error #525).
    dedupe: ["three", "react", "react-dom", "react/jsx-runtime"],
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    host: true,
    port: 5176,
  },
  build: {
    target: "es2020",
    outDir: "dist",
    sourcemap: false,
  },
});
