import type { Server, ServerWebSocket } from "bun";
import { createLogger } from "../lib/logger";

const logger = createLogger("ws:draft-room");

export interface DraftRoomSocketData {
  leagueId: string;
}

const DRAFT_ROOM_PATH = /^\/ws\/draft\/([^/]+)$/;

/**
 * STUB — the upgrade route, connection lifecycle, and per-league socket bookkeeping
 * are real; the actual draft protocol (pick broadcasts, clock, trades) ships in a
 * follow-up session. Keeping this wired now means that work is additive, not new infra.
 */
export function tryUpgradeDraftRoom(req: Request, server: Server<DraftRoomSocketData>): boolean {
  const url = new URL(req.url);
  const match = url.pathname.match(DRAFT_ROOM_PATH);
  if (!match) return false;

  const leagueId = match[1] as string;
  return server.upgrade(req, { data: { leagueId } });
}

export const draftRoomWebSocketHandlers = {
  open(ws: ServerWebSocket<DraftRoomSocketData>) {
    logger.info("draft room socket opened (stub — no draft logic yet)", { leagueId: ws.data.leagueId });
    ws.subscribe(`draft:${ws.data.leagueId}`);
  },
  message(ws: ServerWebSocket<DraftRoomSocketData>, _message: string | Buffer) {
    ws.send(JSON.stringify({ type: "not_implemented", message: "Draft room is not live yet." }));
  },
  close(ws: ServerWebSocket<DraftRoomSocketData>) {
    ws.unsubscribe(`draft:${ws.data.leagueId}`);
  },
};
