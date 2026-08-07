import { NotImplementedError } from "../../lib/errors";

/**
 * STUB — schema (scoring_rulesets/team_event_scores/manager_scores) already carries
 * the rookie-bonus amounts and both tiebreaker fields from the spec. The inverse
 * error function qualification formula and alliance/playoff/award point logic ship
 * in a follow-up session.
 */
export async function getLeagueStandings(_leagueId: string): Promise<never> {
  throw new NotImplementedError("Scoring engine");
}

export async function getManagerScore(_leagueMemberId: string): Promise<never> {
  throw new NotImplementedError("Scoring engine");
}
