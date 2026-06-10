import { AnimatePresence, motion } from "framer-motion";
import { AlignLeft, GripVertical, Hand, MessageSquare, MousePointer2, Star } from "lucide-react";
import { useState } from "react";
import { transition } from "@matrix-platform/ui";
import "./empty-state.css";

const ESC_TIP_DURATION = 2;
const VIEWS_TIMES = [0, 0.08, 0.2, 0.24, 0.26, 0.42, 0.5, 0.54, 0.56, 0.72, 0.88, 1];
const VIEWS_TRANSITION = {
  duration: 6,
  repeat: Infinity,
  times: VIEWS_TIMES,
  ease: "easeInOut" as const,
};
const SECTION_STEP = 29;
const SECTION_CYCLE_TIMES = [0, 0.08, 0.18, 0.24, 0.4, 0.46, 0.54, 0.6, 0.76, 0.82, 0.92, 1];
const SECTION_CYCLE_TRANSITION = {
  duration: 9,
  repeat: Infinity,
  times: SECTION_CYCLE_TIMES,
  ease: "easeInOut" as const,
};

const vizFav = (
  <div className="tipviz">
    <div className="tipviz__row">
      <span className="tipviz__ava" />
      <span className="tipviz__lines">
        <i />
        <i className="short" />
      </span>
      <span className="tipviz__star">
        <Star size={15} fill="currentColor" />
      </span>
    </div>
  </div>
);

const vizViews = (
  <div className="tipviz tipviz--views">
    <motion.div
      className="tipviz__view"
      animate={{
        scale: [1, 1, 1, 1.05, 1.05, 1.05, 1.05, 1, 1, 1, 1, 1],
        boxShadow: [
          "var(--shadow-sm)", "var(--shadow-sm)", "var(--shadow-sm)",
          "var(--shadow-md)", "var(--shadow-md)", "var(--shadow-md)", "var(--shadow-md)",
          "var(--shadow-sm)", "var(--shadow-sm)", "var(--shadow-sm)", "var(--shadow-sm)", "var(--shadow-sm)",
        ],
      }}
      transition={VIEWS_TRANSITION}
    >
      <AlignLeft className="tipviz__view-icon" size={12} />
      <span className="tipviz__msg" />
      <span className="tipviz__msg short" />
      <span className="tipviz__msg" />
      <em>Строки</em>
    </motion.div>
    <motion.div
      className="tipviz__view"
      animate={{
        scale: [1, 1, 1, 1, 1, 1, 1, 1.05, 1.05, 1.05, 1, 1],
        boxShadow: [
          "var(--shadow-sm)", "var(--shadow-sm)", "var(--shadow-sm)", "var(--shadow-sm)",
          "var(--shadow-sm)", "var(--shadow-sm)", "var(--shadow-sm)",
          "var(--shadow-md)", "var(--shadow-md)", "var(--shadow-md)",
          "var(--shadow-sm)", "var(--shadow-sm)",
        ],
      }}
      transition={VIEWS_TRANSITION}
    >
      <MessageSquare className="tipviz__view-icon" size={12} />
      <span className="tipviz__bub left" />
      <span className="tipviz__bub right" />
      <span className="tipviz__bub left short" />
      <em>Пузыри</em>
    </motion.div>
    <motion.div
      className="tipviz__views-cursor"
      animate={{
        x: [-30, -30, 126, 126, 126, 126, 264, 264, 264, 264, -30, -30],
        y: [11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11],
        opacity: [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0],
        scale: [1, 1, 1, 0.82, 0.82, 1, 1, 0.82, 0.82, 1, 1, 1],
      }}
      transition={VIEWS_TRANSITION}
    >
      <MousePointer2 size={14} fill="currentColor" />
    </motion.div>
  </div>
);

const vizSections = (
  <div className="tipviz tipviz--sections">
    <motion.div
      className="tipviz__cursor"
      animate={{
        x: [-30, -30, 0, 0, 0, 0, 0, 0, 0, 0, -30, -30],
        y: [12, 12, 12, 12, 41, 41, 70, 70, 12, 12, 12, 12],
        opacity: [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0],
        scale: [1, 1, 1, 0.82, 0.82, 1, 1, 0.82, 0.82, 1, 1, 1],
      }}
      transition={SECTION_CYCLE_TRANSITION}
    >
      <motion.span
        className="tipviz__cursor-icon"
        animate={{ opacity: [1, 1, 0, 0, 1, 1, 0, 0, 1, 1] }}
        transition={{
          duration: 9,
          repeat: Infinity,
          ease: "linear",
          times: [0, 0.179, 0.181, 0.399, 0.401, 0.539, 0.541, 0.759, 0.761, 1],
        }}
      >
        <MousePointer2 size={14} fill="currentColor" />
      </motion.span>
      <motion.span
        className="tipviz__cursor-icon tipviz__cursor-icon--grab"
        animate={{ opacity: [0, 0, 1, 1, 0, 0, 1, 1, 0, 0] }}
        transition={{
          duration: 9,
          repeat: Infinity,
          ease: "linear",
          times: [0, 0.179, 0.181, 0.399, 0.401, 0.539, 0.541, 0.759, 0.761, 1],
        }}
      >
        <Hand size={16} strokeWidth={2.25} />
      </motion.span>
    </motion.div>
    <motion.div
      className="tipviz__sec"
      animate={{
        y: [0, 0, 0, 0, SECTION_STEP, SECTION_STEP, SECTION_STEP, SECTION_STEP, 2 * SECTION_STEP, 2 * SECTION_STEP, 0, 0],
        scale: [1, 1, 1, 1.04, 1.04, 1, 1, 1, 1, 1, 1, 1],
      }}
      transition={SECTION_CYCLE_TRANSITION}
    >
      <GripVertical size={12} />
      <span>Избранное</span>
    </motion.div>
    <motion.div
      className="tipviz__sec"
      animate={{ y: [0, 0, 0, 0, -SECTION_STEP, -SECTION_STEP, -SECTION_STEP, -SECTION_STEP, 0, 0, 0, 0] }}
      transition={SECTION_CYCLE_TRANSITION}
    >
      <GripVertical size={12} />
      <span>Каналы</span>
    </motion.div>
    <motion.div
      className="tipviz__sec"
      animate={{
        y: [0, 0, 0, 0, 0, 0, 0, 0, -2 * SECTION_STEP, -2 * SECTION_STEP, 0, 0],
        scale: [1, 1, 1, 1, 1, 1, 1, 1.04, 1.04, 1, 1, 1],
      }}
      transition={SECTION_CYCLE_TRANSITION}
    >
      <GripVertical size={12} />
      <span>Личные</span>
    </motion.div>
  </div>
);

const vizEsc = (
  <div className="tipviz">
    <div className="tipviz__key-wrap">
      <motion.span
        className="tipviz__key-ripple"
        animate={{
          scale: [1, 1, 1, 2.1, 2.1],
          opacity: [0, 0, 0.7, 0, 0],
        }}
        transition={{ duration: ESC_TIP_DURATION, repeat: Infinity, times: [0, 0.32, 0.36, 0.85, 1], ease: "easeOut" }}
      />
      <motion.span
        className="tipviz__key-ripple"
        animate={{
          scale: [1, 1, 1, 2.4, 2.4],
          opacity: [0, 0, 0.5, 0, 0],
        }}
        transition={{ duration: ESC_TIP_DURATION, repeat: Infinity, times: [0, 0.42, 0.46, 0.95, 1], ease: "easeOut" }}
      />
      <motion.span
        className="tipviz__key"
        animate={{
          y: [0, 0, 2, 2, 0, 0],
          boxShadow: [
            "0 2px 0 var(--color-border-strong)",
            "0 2px 0 var(--color-border-strong)",
            "0 0 0 var(--color-border-strong)",
            "0 0 0 var(--color-border-strong)",
            "0 2px 0 var(--color-border-strong)",
            "0 2px 0 var(--color-border-strong)",
          ],
          backgroundColor: [
            "var(--color-bg)",
            "var(--color-bg)",
            "var(--color-bg-sunken)",
            "var(--color-bg-sunken)",
            "var(--color-bg)",
            "var(--color-bg)",
          ],
        }}
        transition={{ duration: ESC_TIP_DURATION, repeat: Infinity, times: [0, 0.3, 0.36, 0.52, 0.6, 1], ease: "easeInOut" }}
      >
        esc
      </motion.span>
    </div>
  </div>
);

const vizWelcome = (
  <div className="tipviz">
    <img className="tipviz__logo-img" src="/logo.png" alt="Surf Chat" />
  </div>
);

const TIPS = [
  {
    title: "Это Surf Chat",
    text: "Выберите чат слева — и поехали. А пока пара мелочей, которые делают список удобнее.",
    viz: vizWelcome,
  },
  {
    title: "Закрепляйте важное",
    text: "Нажмите звёздочку у чата — он переедет в «Избранное» наверх. Перетаскивайте, чтобы расставить по порядку.",
    viz: vizFav,
  },
  {
    title: "Лента — как удобнее",
    text: "В шапке открытого чата справа — иконка переключения вида. Жмёте и видите ленту строками или пузырями.",
    viz: vizViews,
  },
  {
    title: "Список под себя",
    text: "Наведите на заголовок раздела и потяните за ручку слева — меняйте местами «Избранное», «Каналы» и «Личные».",
    viz: vizSections,
  },
  {
    title: "Быстрый выход",
    text: "Открыли не тот чат? Нажмите Esc — и вернётесь на этот экран.",
    viz: vizEsc,
  },
] as const;

export function EmptyState() {
  const [[index, direction], setState] = useState<[number, 1 | -1]>([0, 1]);
  const tip = TIPS[index];

  const go = (next: number) => {
    const clamped = Math.max(0, Math.min(TIPS.length - 1, next));
    if (clamped === index) return;
    setState([clamped, clamped > index ? 1 : -1]);
  };

  return (
    <div className="tips">
      <div className="tips__card">
        <div className="tips__viewport">
          <AnimatePresence mode="wait" custom={direction} initial={false}>
            <motion.div
              key={index}
              className="tips__slide"
              custom={direction}
              variants={{
                enter: (dir: 1 | -1) => ({ x: dir * 48, opacity: 0 }),
                center: { x: 0, opacity: 1 },
                exit: (dir: 1 | -1) => ({ x: dir * -48, opacity: 0 }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={transition.base}
            >
              <div className="tips__visual">{tip.viz}</div>
              <div className="tips__title">{tip.title}</div>
              <div className="tips__text">{tip.text}</div>
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="tips__dots">
          {TIPS.map((_, tipIndex) => (
            <button
              key={tipIndex}
              type="button"
              className={`tips__dot${tipIndex === index ? " is-active" : ""}`}
              onClick={() => go(tipIndex)}
              aria-label={`Подсказка ${tipIndex + 1}`}
            />
          ))}
        </div>
      </div>
      <div className="tips__nav">
        <button type="button" className="tips__btn" onClick={() => go(index - 1)} disabled={index === 0}>
          ‹ Назад
        </button>
        <button
          type="button"
          className="tips__btn"
          onClick={() => go(index + 1)}
          disabled={index === TIPS.length - 1}
        >
          Дальше ›
        </button>
      </div>
    </div>
  );
}
