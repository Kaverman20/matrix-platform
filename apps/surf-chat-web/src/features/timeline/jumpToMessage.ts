const CHAT_SCOPE = ".chat-main";

export function findMessageNode(messageId: string, scope = CHAT_SCOPE): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    `${scope} [data-mid="${CSS.escape(messageId)}"]`,
  );
}

/** Whether the message row is rendered and roughly on screen (not virtualized away). */
export function isMessageNodeVisible(node: HTMLElement): boolean {
  const rect = node.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;

  const viewportHeight = window.innerHeight;
  const margin = viewportHeight * 0.12;
  return rect.bottom > margin && rect.top < viewportHeight - margin;
}

export function scrollMessageNodeIntoView(
  messageId: string,
  scope = CHAT_SCOPE,
): boolean {
  const node = findMessageNode(messageId, scope);
  if (!node) return false;

  node.scrollIntoView({ block: "center", behavior: "auto" });
  return isMessageNodeVisible(node);
}

export function waitAnimationFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}
