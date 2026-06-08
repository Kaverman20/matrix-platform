import { MATRIX_ORG_HOMESERVER } from "@matrix-platform/matrix-core";

export const DEFAULT_HOMESERVER =
  import.meta.env.VITE_DEFAULT_HOMESERVER ?? MATRIX_ORG_HOMESERVER;

