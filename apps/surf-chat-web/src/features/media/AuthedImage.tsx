import { useAuthedBlob } from "./useAuthedBlob";

type Props = {
  /** Authenticated Matrix media URL (from mxcUrlToHttp with useAuthentication). */
  url: string | undefined;
  className?: string;
  alt?: string;
};

/**
 * Renders an <img> for Synapse authenticated media: fetches the blob with the
 * access token (a plain <img> can't send the Authorization header). Renders
 * nothing until the blob is ready, so callers should provide a fallback (an
 * initial / icon) behind it.
 */
export function AuthedImage({ url, className, alt = "" }: Props) {
  const { src } = useAuthedBlob(url);
  if (!src) return null;
  return <img className={className} src={src} alt={alt} />;
}
