/** Unified bubble outline — body + tail in one path (telegram-tt appendix geometry),
 *  with per-corner radii so consecutive bubbles "glue" (reduced radius on the
 *  stacked side, Telegram-style). */

const R = 16; // full corner
const RS = 6; // glued (attached) corner
const TAIL = 17;

export type BubblePosition = "single" | "first" | "middle" | "last";

type Corners = { tl: number; tr: number; br: number; bl: number };

/** Whether a bubble at this position carries the tail (bottom corner on its side). */
export function isTailed(position: BubblePosition): boolean {
  return position === "single" || position === "last";
}

/** Corner radii for the given side + position. Own bubbles stack on the right
 *  (tail bottom-right), incoming on the left (tail bottom-left); the corners
 *  touching a neighbour shrink to RS. */
function cornersFor(own: boolean, position: BubblePosition): Corners {
  const full: Corners = { tl: R, tr: R, br: R, bl: R };
  if (position === "single") return full;

  if (own) {
    // Stacked edge is the right side.
    if (position === "first") return { tl: R, tr: R, br: RS, bl: R };
    if (position === "middle") return { tl: R, tr: RS, br: RS, bl: R };
    return { tl: R, tr: RS, br: R, bl: R }; // last
  }
  // Incoming — stacked edge is the left side.
  if (position === "first") return { tl: R, tr: R, br: R, bl: RS };
  if (position === "middle") return { tl: RS, tr: R, br: R, bl: RS };
  return { tl: RS, tr: R, br: R, bl: R }; // last
}

/** Plain rounded rectangle with independent corner radii. */
function roundedRectPath(w: number, h: number, c: Corners): string {
  return [
    `M ${c.tl} 0`,
    `H ${w - c.tr}`,
    `Q ${w} 0 ${w} ${c.tr}`,
    `V ${h - c.br}`,
    `Q ${w} ${h} ${w - c.br} ${h}`,
    `H ${c.bl}`,
    `Q 0 ${h} 0 ${h - c.bl}`,
    `V ${c.tl}`,
    `Q 0 0 ${c.tl} 0`,
    "Z",
  ].join(" ");
}

/** Outgoing bubble with tail at bottom-right; tl/tr/bl honour `c`. */
function outgoingTailPath(w: number, h: number, c: Corners): string {
  const yt = h - TAIL;
  return [
    `M ${c.tl} 0`,
    `H ${w - c.tr}`,
    `Q ${w} 0 ${w} ${c.tr}`,
    `V ${yt}`,
    `C ${w + 0.193} ${yt + 2.84} ${w + 0.876} ${yt + 5.767} ${w + 2.05} ${yt + 8.782}`,
    `C ${w + 2.954} ${yt + 11.107} ${w + 4.496} ${yt + 13.267} ${w + 6.575} ${yt + 15.262}`,
    `A 1 1 0 0 1 ${w + 6} ${h}`,
    `L ${w} ${h}`,
    `H ${c.bl}`,
    `Q 0 ${h} 0 ${h - c.bl}`,
    `V ${c.tl}`,
    `Q 0 0 ${c.tl} 0`,
    "Z",
  ].join(" ");
}

/** Incoming bubble with tail at bottom-left; tl/tr/br honour `c`. */
function incomingTailPath(w: number, h: number, c: Corners): string {
  const yt = h - TAIL;
  return [
    `M ${c.tl} 0`,
    `H ${w - c.tr}`,
    `Q ${w} 0 ${w} ${c.tr}`,
    `V ${h - c.br}`,
    `Q ${w} ${h} ${w - c.br} ${h}`,
    `H 0`,
    `L -6 ${h}`,
    `A 1 1 0 0 0 -6.575 ${yt + 15.262}`,
    `C -4.504 ${yt + 13.267} -2.954 ${yt + 11.107} -2.05 ${yt + 8.782}`,
    `C -0.876 ${yt + 5.767} -0.193 ${yt + 2.84} 0 ${yt}`,
    `V ${c.tl}`,
    `Q 0 0 ${c.tl} 0`,
    "Z",
  ].join(" ");
}

/** The bubble outline for a side + grouping position. */
export function bubblePath(w: number, h: number, own: boolean, position: BubblePosition): string {
  const c = cornersFor(own, position);
  if (!isTailed(position)) return roundedRectPath(w, h, c);
  return own ? outgoingTailPath(w, h, c) : incomingTailPath(w, h, c);
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
