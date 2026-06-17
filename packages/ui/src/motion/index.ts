import type { Transition, Variants } from "framer-motion";

export const duration = {
  instant: 0.08,
  fast: 0.14,
  base: 0.2,
  slow: 0.28,
  page: 0.36,
} as const;

export const ease = {
  standard: [0.2, 0, 0, 1],
  out: [0, 0, 0, 1],
  in: [0.5, 0, 1, 1],
} as const;

export const spring = {
  soft: { type: "spring", stiffness: 320, damping: 30 } as Transition,
  snappy: { type: "spring", stiffness: 500, damping: 32 } as Transition,
  gentle: { type: "spring", stiffness: 180, damping: 24 } as Transition,
} as const;

export const transition = {
  fast: { duration: duration.fast, ease: ease.standard } as Transition,
  base: { duration: duration.base, ease: ease.standard } as Transition,
  slow: { duration: duration.slow, ease: ease.standard } as Transition,
} as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: transition.base },
  exit: { opacity: 0, y: 4, transition: transition.fast },
};

export const fade: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: transition.base },
  exit: { opacity: 0, transition: transition.fast },
};

/** Symmetric crossfade for full-page view swaps (chat ↔ settings). */
export const pageCrossfade: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.44, ease: ease.standard } },
  exit: { opacity: 0, transition: { duration: 0.44, ease: ease.standard } },
};

export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 24 },
  visible: { opacity: 1, x: 0, transition: transition.slow },
  exit: { opacity: 0, x: 24, transition: transition.fast },
};

export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: -4 },
  visible: { opacity: 1, scale: 1, y: 0, transition: transition.fast },
  exit: { opacity: 0, scale: 0.96, y: -4, transition: { duration: duration.instant } },
};

export const pressable = {
  whileTap: { scale: 0.98 },
  transition: spring.snappy,
} as const;

