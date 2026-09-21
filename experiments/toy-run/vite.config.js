import { defineConfig } from "vite";
import { execFileSync } from "node:child_process";
let sourceCommit = "unknown";
try {
  sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();
} catch {}
export default defineConfig({
  define: { __BUILD_COMMIT__: JSON.stringify(sourceCommit) },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("@dimforge")) return "physics";
          if (id.includes("/three/")) return "graphics";
        },
      },
    },
  },
});
