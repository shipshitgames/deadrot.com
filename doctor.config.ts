import { defineConfig } from "react-doctor/api";

export default defineConfig({
  ignore: {
    // ignore.files globs are matched per-project-relative. Keep conventional
    // navigation metadata files out of unused-file diagnostics if a React app
    // adds them later.
    files: ["**/_meta.js", "**/_meta.ts", "**/_meta.tsx"],
  },
});
