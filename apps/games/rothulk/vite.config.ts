import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Relative base keeps the static build usable behind the monorepo hub route.
export default defineConfig({
  plugins: [react()],
  base: "./",
  resolve: {
    dedupe: ["three", "react", "react-dom", "react/jsx-runtime"],
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    host: true,
    port: 5177,
  },
  build: {
    target: "es2020",
    outDir: "dist",
    sourcemap: true,
  },
});
