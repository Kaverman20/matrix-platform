import { useState } from "react";
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
        value={draft}
        rows={1}
        placeholder="Сообщение"
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

