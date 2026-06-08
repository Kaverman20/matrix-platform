import { useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import { sendTextMessage } from "@matrix-platform/matrix-core";
import { useMatrix } from "../../app/providers/MatrixContext";
import "./composer.css";

type Props = {
  roomId: string;
};

export function Composer({ roomId }: Props) {
  const { client } = useMatrix();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, []);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
    textarea.style.overflowY = textarea.scrollHeight > 150 ? "auto" : "hidden";
  }, [draft]);

  const send = async () => {
    const text = draft.trim();
    if (!client || !text || sending) return;

    setDraft("");
    setSending(true);
    try {
      await sendTextMessage(client, roomId, text);
    } catch (e) {
      setDraft(text);
      console.error("[send-message]", e);
    } finally {
      setSending(false);
    }
  };

  return (
    <form
      className="composer"
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
    >
      <textarea
        ref={textareaRef}
        value={draft}
        rows={1}
        placeholder="Сообщение"
        disabled={sending}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void send();
          }
        }}
      />
      <button type="submit" disabled={!draft.trim() || sending} title="Отправить">
        <ArrowUp size={18} />
      </button>
    </form>
  );
}
