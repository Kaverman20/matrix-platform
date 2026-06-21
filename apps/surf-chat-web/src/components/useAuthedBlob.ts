import { useEffect, useState } from "react";
import { useMatrix } from "../app/providers/MatrixContext";

export function useAuthedBlob(url: string | undefined): {
  failed: boolean;
  src?: string;
} {
  const { client } = useMatrix();
  const [state, setState] = useState<{
    failed: boolean;
    src?: string;
    url?: string;
  }>({ failed: false });

  useEffect(() => {
    if (!url || !client) return;

    let objectUrl: string | undefined;
    let cancelled = false;
    const token = client.getAccessToken();

    fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
      .then((response) => {
        if (!response.ok) throw new Error(`media ${response.status}`);
        return response.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setState({ failed: false, src: objectUrl, url });
      })
      .catch(() => {
        if (!cancelled) setState({ failed: true, url });
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [client, url]);

  if (!url || state.url !== url) return { failed: false };
  return { failed: state.failed, src: state.src };
}
