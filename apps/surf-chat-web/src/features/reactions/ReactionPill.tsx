import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { MatrixReaction } from "@matrix-platform/matrix-core";
import { spring, transition } from "@matrix-platform/ui";
import "./reaction-pill.css";

type Props = {
  reaction: MatrixReaction;
  onToggle: () => void;
};

export function ReactionPill({ reaction, onToggle }: Props) {
  const [burst, setBurst] = useState(true);
  const names =
    reaction.senders.length <= 3
      ? reaction.senders.join(", ")
      : `${reaction.senders.slice(0, 3).join(", ")} и ещё ${reaction.senders.length - 3}`;

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setBurst(false), 650);
    return () => window.clearTimeout(timeoutId);
  }, []);

  return (
    <motion.button
      type="button"
      className={`reaction-pill${reaction.mine ? " is-mine" : ""}`}
      title={names}
      aria-pressed={reaction.mine}
      onClick={onToggle}
      layout
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.5, opacity: 0 }}
      transition={spring.snappy}
      whileTap={{ scale: 0.92 }}
    >
      <span className="reaction-pill__emoji-wrap">
        <motion.span
          className="reaction-pill__emoji"
          initial={{ scale: 0.4 }}
          animate={{ scale: 1 }}
          transition={spring.snappy}
        >
          {reaction.key}
        </motion.span>
        <AnimatePresence>
          {burst && (
            <motion.span
              className="reaction-pill__burst"
              initial={{ scale: 0.6, opacity: 0.9, y: 0 }}
              animate={{ scale: 2.2, opacity: 0, y: -22 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              aria-hidden
            >
              {reaction.key}
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      <motion.strong
        key={reaction.count}
        initial={{ scale: 1.4 }}
        animate={{ scale: 1 }}
        transition={transition.fast}
      >
        {reaction.count}
      </motion.strong>
    </motion.button>
  );
}
