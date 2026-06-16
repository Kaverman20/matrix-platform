import type { MatrixClient } from "matrix-js-sdk";

/**
 * Resolves an mxc:// URI to a cropped square thumbnail HTTP URL of the given
 * pixel size, or undefined when there is no avatar. Mirrors the thumbnail
 * params used across the app (crop, allowDirectLinks/allowRedirects on).
 */
export function mxcThumbnailUrl(
  client: MatrixClient,
  mxc: string | null | undefined,
  size: number,
): string | undefined {
  if (!mxc) return undefined;
  return client.mxcUrlToHttp(mxc, size, size, "crop", false, true, true) ?? undefined;
}
