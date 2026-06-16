import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// E2EE is deferred: `enableEncryption()` is never called, so matrix-js-sdk's
// rust-crypto path (and its ~5.5 MB wasm) never executes at runtime — the wasm
// only sits in dist as dead deploy weight (see docs/DECISIONS.md). Drop the
// unused binary from the bundle. Reversible: remove this plugin when E2EE lands.
function dropUnusedCryptoWasm(): Plugin {
  return {
    name: "drop-unused-crypto-wasm",
    apply: "build",
    generateBundle(_options, bundle) {
      for (const fileName of Object.keys(bundle)) {
        if (/matrix_sdk_crypto_wasm.*\.wasm$/.test(fileName)) {
          delete bundle[fileName];
        }
      }
    },
  };
}

// Split the big, statically-imported dependencies into long-lived vendor chunks
// so the browser caches and parses them in parallel and an app-code change
// doesn't invalidate them. Everything else returns undefined so Rolldown keeps
// its own decisions — in particular emoji-mart, which is only reached via a
// dynamic import, must stay in its own async chunk and not get hoisted here.
function manualChunks(id: string): string | undefined {
  if (!id.includes("node_modules")) return undefined;
  if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return "react";
  if (id.includes("matrix-js-sdk")) return "matrix-sdk";
  if (id.includes("framer-motion")) return "motion";
  return undefined;
}

export default defineConfig({
  envDir: "../..",
  plugins: [react(), dropUnusedCryptoWasm()],
  build: {
    rollupOptions: {
      output: { manualChunks },
    },
  },
});
