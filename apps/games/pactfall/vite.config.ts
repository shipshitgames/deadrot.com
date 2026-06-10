import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Relative base keeps the static build usable behind the monorepo hub route.
export default defineConfig({
  plugins: [react()],
  base: "./",
  resolve: {
    // Dedupe so @shipshitgames/ui (react peer dep) shares one copy of react
    // with the app. Two react copies in the prod bundle cause React error #525.
    dedupe: ["three", "react", "react-dom", "react/jsx-runtime"],
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    host: true,
    port: 5175,
  },
  build: {
    target: "es2020",
    outDir: "dist",
    sourcemap: false,
  },
});
