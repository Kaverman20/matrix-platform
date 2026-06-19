export type MatrixMentionMember = {
  userId: string;
  name: string;
};

export type MentionTrigger = {
  /** Index of `@` in the draft. */
  start: number;
  query: string;
};

export type ResolvedMentions = {
  body: string;
  userIds: string[];
  formattedBody: string;
};

/** Returns an active `@` mention query when the caret is inside one. */
export function findMentionTrigger(text: string, cursor: number): MentionTrigger | null {
  if (cursor < 0 || cursor > text.length) return null;

  const before = text.slice(0, cursor);
  const at = before.lastIndexOf("@");
  if (at === -1) return null;

  const prev = at > 0 ? before[at - 1] : " ";
  if (prev !== " " && prev !== "\n" && prev !== "\t" && prev !== "(") return null;

  const query = before.slice(at + 1);
  if (/[\s]/.test(query)) return null;

  return { start: at, query };
}

export function filterMentionCandidates(
  query: string,
  members: readonly MatrixMentionMember[],
  excludeUserId?: string | null,
): MatrixMentionMember[] {
  const needle = query.trim().toLowerCase();
  const filtered = members.filter((member) => member.userId !== excludeUserId);

  if (!needle) {
    return filtered.slice(0, 8);
  }

  return filtered
    .map((member) => ({
      member,
      score: mentionMatchScore(member, needle),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.member.name.localeCompare(right.member.name))
    .slice(0, 8)
    .map((entry) => entry.member);
}

export function applyMentionSelection(
  text: string,
  triggerStart: number,
  cursor: number,
  member: MatrixMentionMember,
): { text: string; cursor: number } {
  const label = member.name.trim() || member.userId;
  const insertion = `@${label} `;
  const nextText = `${text.slice(0, triggerStart)}${insertion}${text.slice(cursor)}`;
  const nextCursor = triggerStart + insertion.length;
  return { text: nextText, cursor: nextCursor };
}

/** Resolves `@DisplayName` tokens to Matrix user ids for outgoing events. */
export function resolveMentionsForSend(
  text: string,
  members: readonly MatrixMentionMember[],
): ResolvedMentions {
  const userIds = new Set<string>();
  let formattedBody = "";
  let cursor = 0;

  for (const match of text.matchAll(/(^|[\s(])@([^\s@][^\s]*)/g)) {
    const prefix = match[1] ?? "";
    const rawLabel = match[2] ?? "";
    const tokenStart = (match.index ?? 0) + prefix.length;
    const member = resolveMentionLabel(rawLabel, members);

    formattedBody += escapeHtml(text.slice(cursor, tokenStart));
    if (member) {
      userIds.add(member.userId);
      formattedBody += `<a href="https://matrix.to/#/${encodeURIComponent(member.userId)}">@${escapeHtml(member.name.trim() || member.userId)}</a>`;
    } else {
      formattedBody += escapeHtml(`@${rawLabel}`);
    }
    cursor = tokenStart + 1 + rawLabel.length;
  }

  formattedBody += escapeHtml(text.slice(cursor));

  return {
    body: text,
    userIds: [...userIds],
    formattedBody,
  };
}

function resolveMentionLabel(
  label: string,
  members: readonly MatrixMentionMember[],
): MatrixMentionMember | null {
  const trimmed = label.trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();
  const exact = members.find((member) =>
    member.userId.toLowerCase() === lower
    || member.name.trim().toLowerCase() === lower
    || localpart(member.userId).toLowerCase() === lower,
  );
  if (exact) return exact;

  const prefixMatches = members.filter((member) =>
    member.name.trim().toLowerCase().startsWith(lower)
    || localpart(member.userId).toLowerCase().startsWith(lower),
  );
  if (prefixMatches.length === 1) return prefixMatches[0] ?? null;

  return null;
}

function mentionMatchScore(member: MatrixMentionMember, query: string): number {
  const name = member.name.trim().toLowerCase();
  const userId = member.userId.toLowerCase();
  const local = localpart(member.userId).toLowerCase();

  if (local === query || name === query || userId === query) return 100;
  if (local.startsWith(query)) return 80;
  if (name.startsWith(query)) return 70;
  if (local.includes(query)) return 40;
  if (name.includes(query)) return 30;
  return 0;
}

function localpart(userId: string): string {
  return userId.startsWith("@") ? userId.slice(1).split(":")[0] ?? userId : userId;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
