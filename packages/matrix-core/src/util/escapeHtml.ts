/**
 * HTML-escape untrusted text before inserting it into a Matrix
 * `formatted_body`. Escapes the characters that matter inside double-quoted
 * attributes and element content; the single quote is intentionally left
 * unescaped (attributes are always double-quoted here).
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
