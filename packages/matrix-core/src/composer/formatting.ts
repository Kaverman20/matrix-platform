export type TextWrapMode = "bold" | "italic" | "code" | "link" | "strikethrough" | "quote";

export type TextTransformMode = "upper" | "lower" | "title" | "clear";

const WRAP: Record<Exclude<TextWrapMode, "link" | "quote">, { open: string; close: string }> = {
  bold: { open: "**", close: "**" },
  italic: { open: "_", close: "_" },
  code: { open: "`", close: "`" },
  strikethrough: { open: "~~", close: "~~" },
};

/** Wraps the current textarea selection with markdown-lite markers. */
export function wrapComposerSelection(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  mode: TextWrapMode,
  linkUrl = "https://",
): { text: string; selectionStart: number; selectionEnd: number } {
  const start = Math.min(selectionStart, selectionEnd);
  const end = Math.max(selectionStart, selectionEnd);
  const selected = text.slice(start, end);

  if (mode === "link") {
    const label = selected || "текст";
    const insertion = `[${label}](${linkUrl})`;
    const nextText = `${text.slice(0, start)}${insertion}${text.slice(end)}`;
    const linkStart = start + 1;
    const linkEnd = linkStart + label.length;
    return { text: nextText, selectionStart: linkStart, selectionEnd: linkEnd };
  }

  if (mode === "quote") {
    const quoted = selected
      ? selected.split("\n").map((line) => (line.startsWith("> ") ? line : `> ${line}`)).join("\n")
      : "> ";
    const nextText = `${text.slice(0, start)}${quoted}${text.slice(end)}`;
    const nextEnd = start + quoted.length;
    return { text: nextText, selectionStart: start, selectionEnd: nextEnd };
  }

  const wrap = WRAP[mode];
  if (selected) {
    const insertion = `${wrap.open}${selected}${wrap.close}`;
    const nextText = `${text.slice(0, start)}${insertion}${text.slice(end)}`;
    return {
      text: nextText,
      selectionStart: start + wrap.open.length,
      selectionEnd: start + wrap.open.length + selected.length,
    };
  }

  const insertion = `${wrap.open}${wrap.close}`;
  const nextText = `${text.slice(0, start)}${insertion}${text.slice(end)}`;
  const caret = start + wrap.open.length;
  return { text: nextText, selectionStart: caret, selectionEnd: caret };
}

export function transformComposerSelection(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  mode: TextTransformMode,
): { text: string; selectionStart: number; selectionEnd: number } {
  const start = Math.min(selectionStart, selectionEnd);
  const end = Math.max(selectionStart, selectionEnd);
  const selected = text.slice(start, end);
  if (!selected) {
    return { text, selectionStart: start, selectionEnd: end };
  }

  let next = selected;
  if (mode === "clear") {
    next = stripMarkdownLite(selected);
  } else if (mode === "upper") {
    next = selected.toUpperCase();
  } else if (mode === "lower") {
    next = selected.toLowerCase();
  } else if (mode === "title") {
    next = selected.replace(/\p{L}+/gu, (word) =>
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
    );
  }

  const nextText = `${text.slice(0, start)}${next}${text.slice(end)}`;
  return { text: nextText, selectionStart: start, selectionEnd: start + next.length };
}

function stripMarkdownLite(value: string): string {
  return value
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/~~(.+?)~~/g, "$1")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^>\s?/gm, "");
}
