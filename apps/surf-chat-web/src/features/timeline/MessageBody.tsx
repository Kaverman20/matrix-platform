import { type ReactNode } from "react";

const URL_PATTERN = /https?:\/\/[^\s<>"']+/g;
const MENTION_PATTERN = /@[\w\d._=/-]+:[\w.-]+/g;
const CODE_BLOCK_PATTERN = /```([\s\S]*?)```/g;
const INLINE_CODE_PATTERN = /`([^`\n]+)`/g;

type Props = {
  text: string;
  formattedBody?: string;
  searchQuery?: string;
};

/** Renders message text with markdown-lite, mentions, and clickable URLs. */
export function MessageBody({ text, formattedBody, searchQuery }: Props) {
  if (formattedBody && !searchQuery?.trim()) {
    const sanitized = sanitizeFormattedHtml(formattedBody);
    if (sanitized) {
      return (
        <span
          className="message-body message-body--rich"
          dangerouslySetInnerHTML={{ __html: sanitized }}
        />
      );
    }
  }

  return <span className="message-body">{renderRichText(text, searchQuery)}</span>;
}

function renderRichText(text: string, searchQuery?: string): ReactNode[] {
  const query = searchQuery?.trim();
  if (query) return renderSearchText(text, query);
  return renderMarkdownText(text);
}

function renderSearchText(text: string, query: string): ReactNode[] {
  const lower = text.toLowerCase();
  const qLower = query.toLowerCase();
  const parts: ReactNode[] = [];
  let start = 0;
  let index = lower.indexOf(qLower);

  while (index !== -1) {
    if (index > start) {
      parts.push(...renderMarkdownText(text.slice(start, index)));
    }
    parts.push(
      <mark key={`${index}:${query}`} className="message-body__mark">
        {text.slice(index, index + query.length)}
      </mark>,
    );
    start = index + query.length;
    index = lower.indexOf(qLower, start);
  }

  if (start < text.length) {
    parts.push(...renderMarkdownText(text.slice(start)));
  }

  return parts.length > 0 ? parts : renderMarkdownText(text);
}

function renderMarkdownText(text: string): ReactNode[] {
  if (!text) return [];

  const parts: ReactNode[] = [];
  let cursor = 0;
  let key = 0;

  for (const match of text.matchAll(CODE_BLOCK_PATTERN)) {
    const index = match.index ?? 0;
    if (index > cursor) {
      parts.push(...renderInlineMarkdown(text.slice(cursor, index), key));
      key += 100;
    }
    parts.push(
      <pre key={`code-${key++}`} className="message-body__code-block">
        <code>{match[1]?.trimEnd()}</code>
      </pre>,
    );
    cursor = index + match[0].length;
  }

  if (cursor < text.length) {
    parts.push(...renderInlineMarkdown(text.slice(cursor), key));
  }

  return parts.length > 0 ? parts : renderInlineMarkdown(text, 0);
}

function renderInlineMarkdown(text: string, keyStart: number): ReactNode[] {
  const parts: ReactNode[] = [];
  let cursor = 0;
  let key = keyStart;

  const pattern = new RegExp(
    `${INLINE_CODE_PATTERN.source}|\\*\\*([^*]+)\\*\\*|~~([^~]+)~~|_([^_\\n]+)_|\\*([^*]+)\\*|${MENTION_PATTERN.source}|${URL_PATTERN.source}`,
    "g",
  );

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const index = match.index;
    if (index > cursor) {
      parts.push(text.slice(cursor, index));
    }

    if (match[0].startsWith("`")) {
      parts.push(
        <code key={`inline-${key++}`} className="message-body__inline-code">
          {match[1]}
        </code>,
      );
    } else if (match[0].startsWith("**")) {
      parts.push(<strong key={`strong-${key++}`}>{match[2]}</strong>);
    } else if (match[0].startsWith("~~")) {
      parts.push(<del key={`strike-${key++}`}>{match[3]}</del>);
    } else if (match[0].startsWith("_")) {
      parts.push(<em key={`em-${key++}`}>{match[4]}</em>);
    } else if (match[0].startsWith("*")) {
      parts.push(<em key={`em-${key++}`}>{match[5]}</em>);
    } else if (match[0].startsWith("@")) {
      parts.push(
        <span key={`mention-${key++}`} className="message-body__mention">
          {match[0]}
        </span>,
      );
    } else {
      const url = trimTrailingPunctuation(match[0]);
      parts.push(
        <a key={`url-${key++}`} href={url} target="_blank" rel="noopener noreferrer">
          {url}
        </a>,
      );
    }

    cursor = index + match[0].length;
  }

  if (cursor < text.length) {
    parts.push(text.slice(cursor));
  }

  return parts.length > 0 ? parts : [text];
}

function sanitizeFormattedHtml(html: string): string | null {
  const withoutReply = html.replace(/<mx-reply>[\s\S]*?<\/mx-reply>/gi, "");
  const allowed = withoutReply
    .replace(/<br\s*\/?>/gi, "<br />")
    .replace(/<\/p>/gi, "<br />")
    .replace(/<p[^>]*>/gi, "")
    .replace(/<(?!(\/)?(a|b|strong|em|i|code|pre|br|span)\b)[^>]+>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .replace(/javascript:/gi, "");

  const text = stripHtml(allowed).trim();
  if (!text) return null;
  return allowed;
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
