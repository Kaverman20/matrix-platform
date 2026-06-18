/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Default Matrix homeserver shown on the login screen. */
  readonly VITE_DEFAULT_HOMESERVER?: string;
  /** App name shown in the UI. */
  readonly VITE_APP_NAME?: string;
  /**
   * Gates the in-development calls feature (MatrixRTC + LiveKit). Off until the
   * Stage 0 RTC backend is deployed and smoke-tested. See ADR 0002.
   */
  readonly VITE_CALLS_ENABLED?: string;
}

declare const __APP_BUILD_ID__: string;

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
