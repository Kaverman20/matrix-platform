import { useEffect, useRef } from "react";
import type { MatrixClient } from "matrix-js-sdk";
import { parseMatrixDeepLink, resolveDeepLink } from "@matrix-platform/matrix-core";

/**
 * Handles matrix.to-style hash links once the Matrix client is ready.
 * Clears the hash after a successful open so reload does not re-join.
 */
export function useDeepLink(
  client: MatrixClient | null,
  onOpenRoom: (roomId: string) => void,
  onFocusMessage?: (roomId: string, messageId: string) => void | Promise<void>,
): void {
  const handledKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!client) return;

    const target = parseMatrixDeepLink(window.location);
    if (!target) return;

    const key = JSON.stringify(target);
    if (handledKeyRef.current === key) return;
    handledKeyRef.current = key;

    void resolveDeepLink(client, target)
      .then((roomId) => {
        onOpenRoom(roomId);
        if (target.type === "room" && target.eventId) {
          // Event-driven focus: ChatShell fires once the room's timeline is
          // ready, instead of guessing a fixed delay that races on slow loads.
          void onFocusMessage?.(roomId, target.eventId);
        }
        window.history.replaceState(
          window.history.state,
          document.title,
          `${window.location.pathname}${window.location.search}`,
        );
      })
      .catch((error) => {
        console.error("[deep-link]", error);
        window.alert("Не удалось открыть ссылку. Возможно, у вас нет доступа к этой комнате.");
      });
  }, [client, onFocusMessage, onOpenRoom]);
}
