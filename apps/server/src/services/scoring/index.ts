import { db, schema } from "@frc-fantasy/db";
import { eq } from "drizzle-orm";
import { NotFoundError } from "../../lib/errors";
import { requireMembership } from "../league";
import { computeLeagueStandings } from "./manager-aggregation";

export async function getLeagueStandings(leagueId: string, userId: string) {
  await requireMembership(leagueId, userId);

  const [league] = await db.select().from(schema.leagues).where(eq(schema.leagues.id, leagueId)).limit(1);
  if (!league) throw new NotFoundError("League");

  const [ruleset] = await db
    .select()
    .from(schema.scoringRulesets)
    .where(eq(schema.scoringRulesets.leagueId, leagueId))
    .limit(1);
  if (!ruleset) throw new Error("league is missing its scoring ruleset row");

  const standings = await computeLeagueStandings(league);
  return {
    standings,
    tiebreaker1: ruleset.tiebreaker1,
    tiebreaker2: ruleset.tiebreaker2,
  };
}

export async function getManagerScore(leagueMemberId: string, userId: string) {
  const [member] = await db
    .select()
    .from(schema.leagueMembers)
    .where(eq(schema.leagueMembers.id, leagueMemberId))
    .limit(1);
  if (!member) throw new NotFoundError("League member");

  await requireMembership(member.leagueId, userId);

  const [league] = await db.select().from(schema.leagues).where(eq(schema.leagues.id, member.leagueId)).limit(1);
  if (!league) throw new NotFoundError("League");

  const standings = await computeLeagueStandings(league);
  const standing = standings.find((s) => s.leagueMemberId === leagueMemberId);
  if (!standing) throw new NotFoundError("Manager standing");
  return standing;
}
