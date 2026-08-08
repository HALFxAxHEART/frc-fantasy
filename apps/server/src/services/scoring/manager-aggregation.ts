import { db, schema, type Tx } from "@frc-fantasy/db";
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { resolveTeamEventPairs } from "./events";
import { ensureTeamEventScoresCached } from "./team-event-scores";

type League = typeof schema.leagues.$inferSelect;

export interface ManagerStandingEvent {
  eventKey: string;
  totalPoints: number;
}

export interface ManagerStanding {
  leagueMemberId: string;
  teamName: string;
  totalPoints: number;
  rookieBonusPoints: number;
  tiebreaker1: number | null;
  tiebreaker2: number | null;
  events: ManagerStandingEvent[];
  computedAt: Date;
}

interface MemberRoster {
  leagueMemberId: string;
  teamName: string;
  teamKeys: string[];
}

function pairKey(teamKey: string, eventKey: string): string {
  return `${teamKey}|${eventKey}`;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

async function loadRosters(tx: Tx, leagueId: string): Promise<MemberRoster[]> {
  const members = await tx
    .select({ id: schema.leagueMembers.id, teamName: schema.leagueMembers.teamName })
    .from(schema.leagueMembers)
    .where(eq(schema.leagueMembers.leagueId, leagueId));

  const result: MemberRoster[] = [];
  for (const member of members) {
    const [roster] = await tx
      .select({ id: schema.rosters.id })
      .from(schema.rosters)
      .where(eq(schema.rosters.leagueMemberId, member.id))
      .limit(1);
    if (!roster) {
      result.push({ leagueMemberId: member.id, teamName: member.teamName, teamKeys: [] });
      continue;
    }

    // Only active (not dropped) slots count toward a manager's score.
    const activeSlots = await tx
      .select({ teamKey: schema.rosterSlots.teamKey })
      .from(schema.rosterSlots)
      .where(and(eq(schema.rosterSlots.rosterId, roster.id), isNull(schema.rosterSlots.droppedAt)));

    result.push({
      leagueMemberId: member.id,
      teamName: member.teamName,
      teamKeys: Array.from(new Set(activeSlots.map((s) => s.teamKey))),
    });
  }
  return result;
}

export async function computeLeagueStandings(league: League): Promise<ManagerStanding[]> {
  return db.transaction(async (tx) => {
    const memberRosters = await loadRosters(tx, league.id);
    const unionTeamKeys = Array.from(new Set(memberRosters.flatMap((m) => m.teamKeys)));

    const pairs = await resolveTeamEventPairs(league, unionTeamKeys);
    const pairSet = new Set(pairs.map((p) => pairKey(p.teamKey, p.eventKey)));
    const distinctEventKeys = Array.from(new Set(pairs.map((p) => p.eventKey)));

    for (const eventKey of distinctEventKeys) {
      const teamKeysAtEvent = pairs.filter((p) => p.eventKey === eventKey).map((p) => p.teamKey);
      await ensureTeamEventScoresCached(eventKey, teamKeysAtEvent);
    }

    const scoreRows =
      unionTeamKeys.length > 0 && distinctEventKeys.length > 0
        ? await tx
            .select()
            .from(schema.teamEventScores)
            .where(
              and(
                inArray(schema.teamEventScores.teamKey, unionTeamKeys),
                inArray(schema.teamEventScores.eventKey, distinctEventKeys),
              ),
            )
        : [];
    // Re-scoped to the exact resolved pairs — the query above is a superset (both
    // dimensions constrained independently for index-friendliness), never trusted as-is.
    const scores = scoreRows.filter((r) => pairSet.has(pairKey(r.teamKey, r.eventKey)));

    const matchRows =
      distinctEventKeys.length > 0
        ? await tx
            .select({
              eventKey: schema.matches.eventKey,
              redTeams: schema.matches.redTeams,
              blueTeams: schema.matches.blueTeams,
              redScore: schema.matches.redScore,
              blueScore: schema.matches.blueScore,
            })
            .from(schema.matches)
            .where(
              and(
                eq(schema.matches.compLevel, "qm"),
                inArray(schema.matches.eventKey, distinctEventKeys),
                isNotNull(schema.matches.redScore),
                isNotNull(schema.matches.blueScore),
              ),
            )
        : [];

    const oprRows =
      unionTeamKeys.length > 0 && distinctEventKeys.length > 0
        ? await tx
            .select()
            .from(schema.oprs)
            .where(
              and(inArray(schema.oprs.teamKey, unionTeamKeys), inArray(schema.oprs.eventKey, distinctEventKeys)),
            )
        : [];
    const oprScoped = oprRows.filter((r) => pairSet.has(pairKey(r.teamKey, r.eventKey)));

    const [ruleset] = await tx
      .select()
      .from(schema.scoringRulesets)
      .where(eq(schema.scoringRulesets.leagueId, league.id))
      .limit(1);
    if (!ruleset) throw new Error("league is missing its scoring ruleset row");

    const teamRows =
      unionTeamKeys.length > 0
        ? await tx.select().from(schema.teams).where(inArray(schema.teams.key, unionTeamKeys))
        : [];
    const rookieYearByTeam = new Map(teamRows.map((t) => [t.key, t.rookieYear]));

    const computedAt = new Date();
    const standings: ManagerStanding[] = memberRosters.map((member) => {
      const memberPairs = pairs.filter((p) => member.teamKeys.includes(p.teamKey));

      const eventTotals = new Map<string, number>();
      for (const pair of memberPairs) {
        const row = scores.find((s) => s.teamKey === pair.teamKey && s.eventKey === pair.eventKey);
        if (!row) continue;
        eventTotals.set(pair.eventKey, (eventTotals.get(pair.eventKey) ?? 0) + Number(row.totalPoints));
      }
      const events: ManagerStandingEvent[] = Array.from(eventTotals.entries()).map(([eventKey, totalPoints]) => ({
        eventKey,
        totalPoints,
      }));
      const eventPointsTotal = events.reduce((sum, e) => sum + e.totalPoints, 0);

      let rookieBonusPoints = 0;
      for (const teamKey of member.teamKeys) {
        const rookieYear = rookieYearByTeam.get(teamKey);
        if (rookieYear == null) continue;
        if (rookieYear === league.seasonYear) rookieBonusPoints += ruleset.rookieBonusFirstYear;
        else if (rookieYear === league.seasonYear - 1) rookieBonusPoints += ruleset.rookieBonusSecondYear;
      }

      const alliancePool: number[] = [];
      for (const pair of memberPairs) {
        for (const match of matchRows) {
          if (match.eventKey !== pair.eventKey) continue;
          const onRed = match.redTeams.includes(pair.teamKey);
          const onBlue = match.blueTeams.includes(pair.teamKey);
          if (!onRed && !onBlue) continue;
          const score = onRed ? match.redScore : match.blueScore;
          if (score != null) alliancePool.push(score);
        }
      }
      const tiebreaker1 = average(alliancePool);

      const oprPool = oprScoped
        .filter((r) => memberPairs.some((p) => p.teamKey === r.teamKey && p.eventKey === r.eventKey))
        .map((r) => Number(r.opr));
      const tiebreaker2 = average(oprPool);

      return {
        leagueMemberId: member.leagueMemberId,
        teamName: member.teamName,
        totalPoints: eventPointsTotal + rookieBonusPoints,
        rookieBonusPoints,
        tiebreaker1,
        tiebreaker2,
        events,
        computedAt,
      };
    });

    standings.sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      const tb1 = (b.tiebreaker1 ?? -Infinity) - (a.tiebreaker1 ?? -Infinity);
      if (tb1 !== 0) return tb1;
      const tb2 = (b.tiebreaker2 ?? -Infinity) - (a.tiebreaker2 ?? -Infinity);
      if (tb2 !== 0) return tb2;
      return a.leagueMemberId.localeCompare(b.leagueMemberId);
    });

    await tx.delete(schema.managerScores).where(eq(schema.managerScores.leagueId, league.id));

    const rowsToInsert: (typeof schema.managerScores.$inferInsert)[] = [];
    for (const standing of standings) {
      for (const event of standing.events) {
        rowsToInsert.push({
          leagueId: league.id,
          leagueMemberId: standing.leagueMemberId,
          eventKey: event.eventKey,
          totalPoints: String(event.totalPoints),
          computedAt: standing.computedAt,
        });
      }
      rowsToInsert.push({
        leagueId: league.id,
        leagueMemberId: standing.leagueMemberId,
        eventKey: null,
        totalPoints: String(standing.totalPoints),
        computedAt: standing.computedAt,
      });
    }
    if (rowsToInsert.length > 0) {
      await tx.insert(schema.managerScores).values(rowsToInsert);
    }

    return standings;
  });
}
