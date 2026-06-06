import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    dedupe: ["three", "react", "react-dom", "react/jsx-runtime"],
  },
  server: {
    host: true,
    port: 5179,
  },
  build: {
    target: "es2020",
    outDir: "dist",
    sourcemap: false,
  },
});
