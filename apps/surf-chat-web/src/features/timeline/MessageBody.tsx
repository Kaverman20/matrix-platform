import { type ReactNode } from "react";

const URL_PATTERN = /https?:\/\/[^\s<>"']+/g;

type Props = {
  text: string;
  formattedBody?: string;
};

/** Renders message text with clickable URLs. Uses formatted_body links when present. */
export function MessageBody({ text, formattedBody }: Props) {
  if (formattedBody && /<a\s/i.test(formattedBody)) {
    return <span className="message-body">{renderFormattedBody(formattedBody, text)}</span>;
  }

  return <span className="message-body">{linkifyPlainText(text)}</span>;
}

function linkifyPlainText(text: string): ReactNode[] {
  if (!text) return [];

  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  URL_PATTERN.lastIndex = 0;
  while ((match = URL_PATTERN.exec(text)) !== null) {
    const url = trimTrailingPunctuation(match[0]);
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <a key={`${match.index}:${url}`} href={url} target="_blank" rel="noopener noreferrer">
        {url}
      </a>,
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

function renderFormattedBody(html: string, fallbackText: string): ReactNode[] {
  const withoutReply = html.replace(/<mx-reply>[\s\S]*?<\/mx-reply>/gi, "");
  const parts: ReactNode[] = [];
  const anchorPattern = /<a\s+href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = anchorPattern.exec(withoutReply)) !== null) {
    const before = stripHtml(withoutReply.slice(lastIndex, match.index));
    if (before) parts.push(before);
    const href = match[1];
    const label = stripHtml(match[2]) || href;
    parts.push(
      <a key={`a-${key++}`} href={href} target="_blank" rel="noopener noreferrer">
        {label}
      </a>,
    );
    lastIndex = match.index + match[0].length;
  }

  const tail = stripHtml(withoutReply.slice(lastIndex));
  if (tail) parts.push(tail);

  if (parts.length === 0) {
    return linkifyPlainText(fallbackText);
  }

  return parts;
}

function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"');
}

function trimTrailingPunctuation(url: string): string {
  return url.replace(/[),.;!?]+$/g, "");
}
