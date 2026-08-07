import { NotImplementedError } from "../../lib/errors";

/**
 * STUB — schema (drafts/draft_picks) is final; snake order, pick timer, and WS
 * broadcast logic ship in a follow-up session. See ws/draft-room.ts for the matching
 * no-op WebSocket upgrade route.
 */
export async function getDraftState(_leagueId: string): Promise<never> {
  throw new NotImplementedError("Draft room");
}

export async function createDraft(_leagueId: string): Promise<never> {
  throw new NotImplementedError("Draft room");
}

export async function makePick(_draftId: string, _teamKey: string): Promise<never> {
  throw new NotImplementedError("Draft room");
}

export async function pauseDraft(_draftId: string): Promise<never> {
  throw new NotImplementedError("Draft room");
}

export async function undoLastPick(_draftId: string): Promise<never> {
  throw new NotImplementedError("Draft room");
}
