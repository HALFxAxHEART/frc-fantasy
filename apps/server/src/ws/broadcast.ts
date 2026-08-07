import type { Server } from "bun";
import type { DraftRoomSocketData } from "./draft-room";

let serverRef: Server<DraftRoomSocketData> | null = null;

/** Called once from index.ts right after Bun.serve() returns. */
export function setBroadcastServer(server: Server<DraftRoomSocketData>): void {
  serverRef = server;
}

/**
 * Push-only change signal — no draft state is ever serialized over the socket.
 * Clients treat any message (and any successful reconnect) as "something changed,
 * refetch via tRPC," which keeps this the single source of truth for draft state.
 */
export function broadcastDraftUpdate(leagueId: string): void {
  serverRef?.publish(`draft:${leagueId}`, JSON.stringify({ type: "draft_updated" }));
}
