import { RelationType, EventType, type MatrixClient, type MatrixEvent, type Room } from "matrix-js-sdk";
import type { MatrixPoll } from "./messageTypes";

const POLL_START_KEY = "org.matrix.msc3381.poll.start";
const POLL_RESPONSE_KEY = "org.matrix.msc3381.poll.response";

export function parsePollFromEvent(
  event: MatrixEvent,
  room: Room | null,
  myUserId: string | null,
): MatrixPoll | null {
  const content = event.getContent();
  const msgtype = content.msgtype;
  if (msgtype !== "m.poll.start" && msgtype !== "org.matrix.msc3381.poll.start") return null;

  const pollStart = (content[POLL_START_KEY] ?? content["m.poll.start"]) as
    | {
        question?: { body?: unknown };
        answers?: Array<{ id?: unknown; body?: unknown }>;
        max_selections?: unknown;
        kind?: unknown;
      }
    | undefined;

  const question =
    typeof pollStart?.question?.body === "string"
      ? pollStart.question.body
      : typeof content.body === "string"
        ? content.body
        : "Опрос";

  const answers = (pollStart?.answers ?? [])
    .map((answer) => ({
      id: typeof answer.id === "string" ? answer.id : "",
      text: typeof answer.body === "string" ? answer.body : "",
    }))
    .filter((answer) => answer.id && answer.text);

  if (answers.length === 0) return null;

  const maxSelections =
    typeof pollStart?.max_selections === "number" && pollStart.max_selections > 0
      ? pollStart.max_selections
      : 1;

  const kind =
    pollStart?.kind === "org.matrix.msc3381.poll.undisclosed" ? "undisclosed" : "disclosed";

  const voteCounts: Record<string, number> = Object.fromEntries(answers.map((a) => [a.id, 0]));
  const voters = new Set<string>();
  let mySelections: string[] = [];

  const eventId = event.getId() ?? "";
  const relations = room?.relations.getChildEventsForEvent(
    eventId,
    RelationType.Reference,
    "m.poll.response",
  );

  for (const response of relations?.getRelations() ?? []) {
    if (response.getContent().msgtype !== "m.poll.response") {
      continue;
    }
    const sender = response.getSender();
    if (!sender) continue;
    voters.add(sender);

    const payload = response.getContent()[POLL_RESPONSE_KEY] as { answers?: unknown } | undefined;
    const selected = Array.isArray(payload?.answers)
      ? payload.answers.filter((value): value is string => typeof value === "string")
      : [];

    if (sender === myUserId) {
      mySelections = selected;
    }

    for (const answerId of selected) {
      if (answerId in voteCounts) voteCounts[answerId] += 1;
    }
  }

  return {
    question,
    answers,
    maxSelections,
    kind,
    closed: false,
    mySelections,
    voteCounts,
    totalVotes: voters.size,
  };
}

export type PollStartInput = {
  question: string;
  answers: string[];
  /** How many options a voter may pick. Defaults to 1 (single choice). */
  maxSelections?: number;
  /** `undisclosed` hides running tallies until the poll is closed. */
  kind?: "disclosed" | "undisclosed";
};

let pollAnswerSeq = 0;

/** Create and send a new poll (MSC3381). */
export async function sendPollStart(
  client: MatrixClient,
  roomId: string,
  input: PollStartInput,
): Promise<void> {
  const question = input.question.trim();
  const answers = input.answers.map((a) => a.trim()).filter(Boolean);
  if (!question || answers.length < 2) return;

  const kind =
    input.kind === "undisclosed"
      ? "org.matrix.msc3381.poll.undisclosed"
      : "org.matrix.msc3381.poll.disclosed";
  const maxSelections = Math.max(1, Math.min(input.maxSelections ?? 1, answers.length));

  const pollAnswers = answers.map((body) => ({
    id: `a${(pollAnswerSeq += 1)}-${body.slice(0, 8)}`,
    "org.matrix.msc1767.text": body,
  }));

  await client.sendEvent(roomId, EventType.RoomMessage, {
    msgtype: POLL_START_KEY,
    // Plain-text fallback for clients that don't render polls.
    body: `${question}\n${answers.map((a) => `- ${a}`).join("\n")}`,
    [POLL_START_KEY]: {
      question: { body: question, "org.matrix.msc1767.text": question },
      kind,
      max_selections: maxSelections,
      answers: pollAnswers.map((a) => ({
        id: a.id,
        body: a["org.matrix.msc1767.text"],
        "org.matrix.msc1767.text": a["org.matrix.msc1767.text"],
      })),
    },
  } as never);
}

export async function sendPollResponse(
  client: MatrixClient,
  roomId: string,
  pollStartEventId: string,
  answerIds: string[],
): Promise<void> {
  if (answerIds.length === 0) return;

  await client.sendEvent(roomId, EventType.RoomMessage, {
    msgtype: "m.poll.response",
    body: " ",
    [POLL_RESPONSE_KEY]: { answers: answerIds },
    "m.relates_to": {
      rel_type: RelationType.Reference,
      event_id: pollStartEventId,
    },
  } as never);
}
