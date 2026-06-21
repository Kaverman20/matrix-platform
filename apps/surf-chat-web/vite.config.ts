import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const appRoot = fileURLToPath(new URL(".", import.meta.url));

function readBuildId(): string {
  try {
    return execSync("git rev-parse --short HEAD", {
      cwd: resolve(appRoot, "../.."),
      encoding: "utf8",
    }).trim();
  } catch {
    return String(Date.now());
  }
}

const appBuildId = readBuildId();

function surfChatBuildIdPlugin(): Plugin {
  return {
    name: "surf-chat-build-id",
    config() {
      return {
        define: {
          __APP_BUILD_ID__: JSON.stringify(appBuildId),
        },
      };
    },
    closeBundle() {
      writeFileSync(resolve(appRoot, "dist/build-id.txt"), `${appBuildId}\n`, "utf8");
    },
  };
}

// Content-Security-Policy as a <meta> tag, injected only into production builds
// (a strict policy would break Vite's dev server / HMR). Mirrors the Caddy header
// served in front of the app (infra/foxhound/*/Caddyfile) so any static-hosted
// build keeps the same protection even without the reverse proxy. frame-ancestors
// is omitted because it is ignored when delivered via <meta> — it must stay in
// the Caddy header.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "connect-src 'self' https://matrix.foxhound.run https://*.foxhound.run wss://matrix-rtc.foxhound.run",
  "img-src 'self' data: blob: https://matrix.foxhound.run",
  "media-src 'self' blob: https://matrix.foxhound.run",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

function surfChatCspPlugin(): Plugin {
  return {
    name: "surf-chat-csp",
    apply: "build",
    transformIndexHtml() {
      return [
        {
          tag: "meta",
          attrs: {
            "http-equiv": "Content-Security-Policy",
            content: CONTENT_SECURITY_POLICY,
          },
          injectTo: "head-prepend",
        },
      ];
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
  if (id.includes("livekit-client")) return "livekit";
  if (id.includes("framer-motion")) return "motion";
  return undefined;
}

export default defineConfig({
  envDir: "../..",
  plugins: [react(), surfChatBuildIdPlugin(), surfChatCspPlugin()],
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
