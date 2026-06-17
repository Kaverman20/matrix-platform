/** Whether the in-development calls feature is enabled (see ADR 0002).
 * Off by default until the Stage 0 RTC backend is deployed and smoke-tested. */
export const CALLS_ENABLED = import.meta.env.VITE_CALLS_ENABLED === "true";
