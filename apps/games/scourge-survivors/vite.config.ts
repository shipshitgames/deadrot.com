import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  // Relative base keeps the static build usable behind the monorepo hub route.
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    // @shipshitgames/engine treats `three` as a peerDependency — collapse it (and its
    // examples/jsm deep imports) onto the game's single copy, so the engine and
    // game don't bundle two three.js instances (the "Multiple instances" warning,
    // bigger bundle, and cross-copy `instanceof` mismatches).
    // Collapse three AND react onto the game's single copy. @shipshitgames/ui
    // takes react as a peer; without this the production bundle can split react /
    // react/jsx-runtime into two instances → React error #525 ("element from an
    // older version of React") at runtime (dev is unaffected; build splits chunks).
    dedupe: ["three", "react", "react-dom", "react/jsx-runtime"],
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    host: true,
    port: 5178,
  },
  build: {
    sourcemap: true,
  },
});
