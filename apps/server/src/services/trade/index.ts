import { NotImplementedError } from "../../lib/errors";

/**
 * STUB — schema (trades/trade_parties/trade_assets, already generic enough for
 * atomic multi-team trades) is final; proposal/accept/execute logic and Lazy Roster
 * Enforcement ship in a follow-up session.
 */
export async function proposeTrade(_leagueId: string): Promise<never> {
  throw new NotImplementedError("Trade market");
}

export async function respondToTrade(_tradeId: string, _accept: boolean): Promise<never> {
  throw new NotImplementedError("Trade market");
}

export async function listTradeBlock(_leagueId: string): Promise<never> {
  throw new NotImplementedError("Trade market");
}
