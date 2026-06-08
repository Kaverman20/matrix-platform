const ROOM_PALETTE = ["#5b6b7a", "#6f7d63", "#a9745b", "#7d6f8c", "#b4795f", "#5e807d"];

export function colorForId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return ROOM_PALETTE[hash % ROOM_PALETTE.length];
}

