import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

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
    port: 5174,
  },
  build: {
    target: "es2020",
    outDir: "dist",
    emptyOutDir: true,
  },
});
