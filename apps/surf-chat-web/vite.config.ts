import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Split the big, statically-imported dependencies into long-lived vendor chunks
// so the browser caches and parses them in parallel and an app-code change
// doesn't invalidate them. Everything else returns undefined so Rolldown keeps
// its own decisions — in particular emoji-mart, which is only reached via a
// dynamic import, must stay in its own async chunk and not get hoisted here.
function manualChunks(id: string): string | undefined {
  if (!id.includes("node_modules")) return undefined;
  if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return "react";
  if (id.includes("matrix-js-sdk")) return "matrix-sdk";
  if (id.includes("livekit-client")) return "livekit";
  if (id.includes("framer-motion")) return "motion";
  return undefined;
}

export default defineConfig({
  envDir: "../..",
  plugins: [react()],
  build: {
    // The dominant chunks (matrix-js-sdk and its crypto WASM) are vendor code a
    // Matrix client must ship regardless; they already live in their own
    // long-lived chunks via manualChunks. Raise the warning threshold so it
    // flags genuine app-code regressions instead of this inherent baseline.
    chunkSizeWarningLimit: 1300,
    rollupOptions: {
      output: { manualChunks },
    },
  },
});
