export type CreateRoomType = "private" | "public";

export type WizardItem = { id: string; name: string; kind: "channel" | "space"; parentId: string };
