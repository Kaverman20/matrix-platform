import { useCallback, useMemo, useState } from "react";
import type {
  MatrixForwardData,
  MatrixMessage,
  MatrixMessageReference,
} from "@matrix-platform/matrix-core";

export function useComposerMode(roomId: string | null | undefined) {
  const [replyTo, setReplyTo] = useState<MatrixMessageReference | null>(null);
  const [editingMessage, setEditingMessage] = useState<MatrixMessageReference | null>(null);
  const [pendingForward, setPendingForward] = useState<MatrixForwardData[] | null>(null);

  const messageReference = useCallback((message: MatrixMessage): MatrixMessageReference => ({
    id: message.id,
    sender: message.sender,
    author: message.own ? "Вы" : message.author,
    text: message.text,
  }), []);

  const startReply = useCallback((message: MatrixMessage) => {
    setEditingMessage(null);
    setPendingForward(null);
    setReplyTo(messageReference(message));
  }, [messageReference]);

  const startEdit = useCallback((message: MatrixMessage) => {
    setReplyTo(null);
    setPendingForward(null);
    setEditingMessage(messageReference(message));
  }, [messageReference]);

  const startForward = useCallback((items: MatrixForwardData[]) => {
    setReplyTo(null);
    setEditingMessage(null);
    setPendingForward(items);
  }, []);

  const clearComposerMode = useCallback(() => {
    setReplyTo(null);
    setEditingMessage(null);
    setPendingForward(null);
  }, []);

  const cancelReply = useCallback(() => setReplyTo(null), []);
  const cancelEdit = useCallback(() => setEditingMessage(null), []);
  const cancelForward = useCallback(() => setPendingForward(null), []);

  const composerKey = useMemo(() => [
    roomId ?? "none",
    editingMessage
      ? `edit:${editingMessage.id}`
      : pendingForward
        ? `forward:${pendingForward.map((item) => item.sender + item.preview).join("|")}`
        : replyTo
          ? `reply:${replyTo.id}`
          : "plain",
  ].join(":"), [editingMessage, pendingForward, replyTo, roomId]);

  return {
    replyTo,
    editingMessage,
    pendingForward,
    composerKey,
    messageReference,
    startReply,
    startEdit,
    startForward,
    clearComposerMode,
    cancelReply,
    cancelEdit,
    cancelForward,
  };
}
