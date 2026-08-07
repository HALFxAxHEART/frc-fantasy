import type { Server, ServerWebSocket } from "bun";
import { createLogger } from "../lib/logger";

const logger = createLogger("ws:draft-room");

export interface DraftRoomSocketData {
  leagueId: string;
}

const DRAFT_ROOM_PATH = /^\/ws\/draft\/([^/]+)$/;

/**
 * Push-only change signal (see ws/broadcast.ts) — clients never send draft actions
 * over this socket, only tRPC mutations do that. `message` is effectively unused;
 * a client "ping" gets a "pong" back purely as a liveness nicety.
 */
export function tryUpgradeDraftRoom(req: Request, server: Server<DraftRoomSocketData>): boolean {
  const url = new URL(req.url);
  const match = url.pathname.match(DRAFT_ROOM_PATH);
  if (!match) return false;

  const leagueId = match[1] as string;
  return server.upgrade(req, { data: { leagueId } });
}

export const draftRoomWebSocketHandlers = {
  // Bun already defaults sendPings:true; a shorter idleTimeout just means dead
  // connections (laptop sleep, etc.) get cleaned up server-side faster, which
  // triggers the client's close→reconnect path sooner.
  idleTimeout: 60,
  open(ws: ServerWebSocket<DraftRoomSocketData>) {
    logger.info("draft room socket opened", { leagueId: ws.data.leagueId });
    ws.subscribe(`draft:${ws.data.leagueId}`);
  },
  message(ws: ServerWebSocket<DraftRoomSocketData>, message: string | Buffer) {
    if (message.toString() === "ping") ws.send("pong");
  },
  close(ws: ServerWebSocket<DraftRoomSocketData>) {
    ws.unsubscribe(`draft:${ws.data.leagueId}`);
  },
};
