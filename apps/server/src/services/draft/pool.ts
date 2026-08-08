import { db, schema, type Database, type Tx } from "@frc-fantasy/db";
import { and, eq, notInArray, sql } from "drizzle-orm";
import { ensureEventsForYearCached, ensureEventTeamsCached, getEventTeams } from "../event";

export interface PoolTeam {
  key: string;
  teamNumber: number;
  nickname: string | null;
}

export type DraftPool = { bounded: true; teams: PoolTeam[] } | { bounded: false };

type League = typeof schema.leagues.$inferSelect;

/**
 * Resolved live at pick-validation time, not snapshotted at draft creation. Safe for
 * event-scoped leagues (attendee lists are final well before an event); a theoretical
 * risk for district/global season-long leagues if ingestion changes the pool mid-draft
 * — accepted for MVP, not building a snapshot mechanism now.
 */
export async function resolveDraftPool(league: League): Promise<DraftPool> {
  if (league.temporalTopology !== "season_long") {
    if (!league.tbaEventKey) throw new Error("event-scoped league missing tbaEventKey");
    const rows = await getEventTeams(league.tbaEventKey);
    return { bounded: true, teams: rows.map((r) => ({ key: r.team.key, teamNumber: r.team.teamNumber, nickname: r.team.nickname })) };
  }

  if (league.spatialTopology === "district") {
    if (!league.districtKey) throw new Error("district league missing districtKey");

    // Cold-start fill: event_teams is otherwise only populated by the daily cron's
    // active-window pass, which could leave a brand-new district league's pool empty
    // for up to 24h. Cheap once warm — each call below is a single indexed check.
    await ensureEventsForYearCached(league.seasonYear);
    const districtEvents = await db
      .select({ key: schema.events.key })
      .from(schema.events)
      .where(and(eq(schema.events.districtKey, league.districtKey), eq(schema.events.year, league.seasonYear)));
    for (const e of districtEvents) {
      await ensureEventTeamsCached(e.key);
    }

    const rows = await db
      .selectDistinctOn([schema.teams.key], {
        key: schema.teams.key,
        teamNumber: schema.teams.teamNumber,
        nickname: schema.teams.nickname,
      })
      .from(schema.eventTeams)
      .innerJoin(schema.events, eq(schema.eventTeams.eventKey, schema.events.key))
      .innerJoin(schema.teams, eq(schema.eventTeams.teamKey, schema.teams.key))
      .where(and(eq(schema.events.districtKey, league.districtKey), eq(schema.events.year, league.seasonYear)));
    return { bounded: true, teams: rows };
  }

  return { bounded: false };
}

export function poolSize(pool: DraftPool): number {
  return pool.bounded ? pool.teams.length : Number.POSITIVE_INFINITY;
}

export async function isTeamInPool(pool: DraftPool, teamKey: string): Promise<boolean> {
  if (pool.bounded) return pool.teams.some((t) => t.key === teamKey);
  const [existing] = await db.select({ key: schema.teams.key }).from(schema.teams).where(eq(schema.teams.key, teamKey)).limit(1);
  return !!existing;
}

export async function alreadyDraftedKeys(executor: Database | Tx, draftId: string): Promise<string[]> {
  const rows = await executor
    .select({ teamKey: schema.draftPicks.teamKey })
    .from(schema.draftPicks)
    .where(and(eq(schema.draftPicks.draftId, draftId), sql`${schema.draftPicks.teamKey} IS NOT NULL`));
  return rows.map((r) => r.teamKey as string);
}

export async function pickRandomAvailableTeam(tx: Tx, draftId: string, pool: DraftPool): Promise<string | null> {
  const drafted = await alreadyDraftedKeys(tx, draftId);

  if (pool.bounded) {
    const available = pool.teams.filter((t) => !drafted.includes(t.key));
    if (available.length === 0) return null;
    return available[Math.floor(Math.random() * available.length)]!.key;
  }

  const [row] = await tx
    .select({ key: schema.teams.key })
    .from(schema.teams)
    .where(drafted.length > 0 ? notInArray(schema.teams.key, drafted) : undefined)
    .orderBy(sql`random()`)
    .limit(1);
  return row?.key ?? null;
}
