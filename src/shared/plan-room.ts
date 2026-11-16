/** Room-only fiscal suggestions; never a ballot or synthesis command. */
export type RoomSeed = { packageId: string; lane: string; budget: number; rows: { id: string; title: string; jurisdiction: string; source: string; amount: number }[] };
export type RoomSnapshot = { expiresAt: number; seed: RoomSeed; people: { alias: string; present: boolean }[]; history: { alias: string; at: number; itemId: string; amount: number }[] };
