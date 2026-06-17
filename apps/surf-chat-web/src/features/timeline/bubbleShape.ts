/** Unified bubble outline — body + tail in one path (telegram-tt appendix geometry). */

const R = 16;
const TAIL = 17;

export function roundBubblePath(w: number, h: number): string {
  return [
    `M ${R} 0`,
    `H ${w - R}`,
    `Q ${w} 0 ${w} ${R}`,
    `V ${h - R}`,
    `Q ${w} ${h} ${w - R} ${h}`,
    `H ${R}`,
    `Q 0 ${h} 0 ${h - R}`,
    `V ${R}`,
    `Q 0 0 ${R} 0`,
    "Z",
  ].join(" ");
}

/** Incoming tail — telegram-tt MessageAppendix mirrored to bottom-left. */
export function incomingTailBubblePath(w: number, h: number): string {
  const yt = h - TAIL;

  return [
    `M ${R} 0`,
    `H ${w - R}`,
    `Q ${w} 0 ${w} ${R}`,
    `V ${h - R}`,
    `Q ${w} ${h} ${w - R} ${h}`,
    `H 0`,
    `L -6 ${h}`,
    `A 1 1 0 0 0 -6.575 ${yt + 15.262}`,
    `C -4.504 ${yt + 13.267} -2.954 ${yt + 11.107} -2.05 ${yt + 8.782}`,
    `C -0.876 ${yt + 5.767} -0.193 ${yt + 2.84} 0 ${yt}`,
    `V ${R}`,
    `Q 0 0 ${R} 0`,
    "Z",
  ].join(" ");
}

/** Outgoing tail — telegram-tt MessageAppendix at bottom-right. */
export function outgoingTailBubblePath(w: number, h: number): string {
  const yt = h - TAIL;

  return [
    `M ${R} 0`,
    `H ${w - R}`,
    `Q ${w} 0 ${w} ${R}`,
    `V ${yt}`,
    `C ${w + 0.193} ${yt + 2.84} ${w + 0.876} ${yt + 5.767} ${w + 2.05} ${yt + 8.782}`,
    `C ${w + 2.954} ${yt + 11.107} ${w + 4.496} ${yt + 13.267} ${w + 6.575} ${yt + 15.262}`,
    `A 1 1 0 0 1 ${w + 6} ${h}`,
    `L ${w} ${h}`,
    `H ${R}`,
    `Q 0 ${h} 0 ${h - R}`,
    `V ${R}`,
    `Q 0 0 ${R} 0`,
    "Z",
  ].join(" ");
}

export const BUBBLE_TAIL_OFFSET = 9;

export function resolveBubbleFill(own: boolean): string {
  const probe = document.createElement("span");
  probe.style.cssText = `position:absolute;visibility:hidden;background:var(${own ? "--color-bubble-own" : "--color-bubble-in"})`;
  document.documentElement.appendChild(probe);
  const fill = getComputedStyle(probe).backgroundColor;
  document.documentElement.removeChild(probe);
  return fill;
}
