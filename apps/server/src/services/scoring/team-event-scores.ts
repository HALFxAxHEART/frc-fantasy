import { db, schema } from "@frc-fantasy/db";
import { and, eq, inArray } from "drizzle-orm";
import { tbaClient } from "../../ingestion/tba-client";
import { createLogger } from "../../lib/logger";

const logger = createLogger("service:scoring:team-event-scores");

/**
 * Cron path (called from daily-ingest's syncEventDetail): upserts raw FIRST District
 * Points for every team TBA reports at this event, straight from TBA's own
 * /event/{key}/district_points — not fatal if it fails (mirrors the OPR sync in the
 * same job), since this event may not have happened yet or TBA hasn't computed it.
 */
export async function syncEventDistrictPoints(eventKey: string) {
  try {
    const { points } = await tbaClient.getEventDistrictPoints(eventKey);
    for (const [teamKey, p] of Object.entries(points)) {
      await db
        .insert(schema.teamEventScores)
        .values({
          teamKey,
          eventKey,
          qualificationPoints: String(p.qual_points),
          allianceSelectionPoints: String(p.alliance_points),
          playoffPoints: String(p.elim_points),
          awardPoints: String(p.award_points),
          totalPoints: String(p.total),
        })
        .onConflictDoUpdate({
          target: [schema.teamEventScores.teamKey, schema.teamEventScores.eventKey],
          set: {
            qualificationPoints: String(p.qual_points),
            allianceSelectionPoints: String(p.alliance_points),
            playoffPoints: String(p.elim_points),
            awardPoints: String(p.award_points),
            totalPoints: String(p.total),
            computedAt: new Date(),
          },
        });
    }
  } catch (err) {
    logger.warn("failed to sync district points for event", { eventKey, error: String(err) });
  }
}

/**
 * On-demand path used by manager aggregation. Scoped to teamKeys the caller already
 * knows are rostered (and therefore already present in `teams`) — the cron path
 * always runs syncTeams(year) first in the same job so every team in TBA's response
 * has a satisfiable FK, but this on-demand path has no such guarantee, so it only
 * ever inserts rows for teams already known locally.
 */
export async function ensureTeamEventScoresCached(eventKey: string, teamKeys: string[]) {
  if (teamKeys.length === 0) return;

  const existing = await db
    .select({ teamKey: schema.teamEventScores.teamKey })
    .from(schema.teamEventScores)
    .where(and(eq(schema.teamEventScores.eventKey, eventKey), inArray(schema.teamEventScores.teamKey, teamKeys)));
  const missing = teamKeys.filter((k) => !existing.some((e) => e.teamKey === k));
  if (missing.length === 0) return;

  try {
    const { points } = await tbaClient.getEventDistrictPoints(eventKey);
    const knownTeams = await db
      .select({ key: schema.teams.key })
      .from(schema.teams)
      .where(inArray(schema.teams.key, missing));
    const knownTeamKeys = new Set(knownTeams.map((t) => t.key));

    for (const teamKey of missing) {
      if (!knownTeamKeys.has(teamKey)) continue;
      const p = points[teamKey];
      if (!p) continue;
      await db
        .insert(schema.teamEventScores)
        .values({
          teamKey,
          eventKey,
          qualificationPoints: String(p.qual_points),
          allianceSelectionPoints: String(p.alliance_points),
          playoffPoints: String(p.elim_points),
          awardPoints: String(p.award_points),
          totalPoints: String(p.total),
        })
        .onConflictDoNothing();
    }
  } catch (err) {
    logger.warn("failed to lazily fetch district points for event", { eventKey, error: String(err) });
  }
}
