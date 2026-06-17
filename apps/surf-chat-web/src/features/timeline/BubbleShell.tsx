import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  BUBBLE_TAIL_OFFSET,
  incomingTailBubblePath,
  outgoingTailBubblePath,
  resolveBubbleFill,
  roundBubblePath,
} from "./bubbleShape";

type Props = {
  own: boolean;
  tailed: boolean;
  highlighted?: boolean;
  children: ReactNode;
};

export function BubbleShell({ own, tailed, highlighted, children }: Props) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [fill, setFill] = useState(() => resolveBubbleFill(own));

  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    const measure = () => setSize({ w: el.offsetWidth, h: el.offsetHeight });
    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    const syncFill = () => setFill(resolveBubbleFill(own));
    syncFill();

    const html = document.documentElement;
    const observer = new MutationObserver(syncFill);
    observer.observe(html, {
      attributes: true,
      attributeFilter: ["data-theme-preset", "class", "style"],
    });
    return () => observer.disconnect();
  }, [own, highlighted]);

  const w = size.w;
  const h = size.h;
  const path =
    w > 0 && h > 0
      ? tailed
        ? own
          ? outgoingTailBubblePath(w, h)
          : incomingTailBubblePath(w, h)
        : roundBubblePath(w, h)
      : "";

  const svgWidth = tailed && !own ? w + BUBBLE_TAIL_OFFSET : tailed && own ? w + BUBBLE_TAIL_OFFSET : w;
  const svgLeft = tailed && !own ? -BUBBLE_TAIL_OFFSET : 0;

  return (
    <div
      className={`bubble bubble--${own ? "own" : "in"}${tailed ? " bubble--has-tail" : ""}${highlighted ? " bubble--highlight" : ""}`}
    >
      {w > 0 && h > 0 && (
        <svg
          className="bubble__shape"
          width={svgWidth}
          height={h}
          style={{ left: svgLeft }}
          viewBox={`${svgLeft < 0 ? -BUBBLE_TAIL_OFFSET : 0} 0 ${svgWidth} ${h}`}
          aria-hidden
        >
          <path d={path} fill={fill} />
        </svg>
      )}
      <div ref={contentRef} className="bubble__content">{children}</div>
    </div>
  );
}
