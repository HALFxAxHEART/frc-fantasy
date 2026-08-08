import { db, schema } from "@frc-fantasy/db";
import { and, eq, inArray } from "drizzle-orm";
import { tbaClient } from "../../ingestion/tba-client";
import { createLogger } from "../../lib/logger";
import { ensureEventsForYearCached, ensureEventTeamsCached } from "../event";
import { ensureEventCached } from "../team";

const logger = createLogger("service:scoring:events");

type League = typeof schema.leagues.$inferSelect;

export interface TeamEventPair {
  teamKey: string;
  eventKey: string;
}

/**
 * event_teams is only ever written from the event side (an event's attendee list),
 * never from a team's own upcoming-events perspective. That's fine for event-scoped
 * and district leagues (their scored events are known up front), but a global
 * season-long league has no other way to learn which events a drafted team is even
 * registered for. This backfills that team's event_teams rows for the season using
 * TBA's team-events endpoint, so global-league standings aren't permanently empty.
 */
export async function ensureTeamEventsCached(teamKey: string, seasonYear: number) {
  const [existing] = await db
    .select({ eventKey: schema.eventTeams.eventKey })
    .from(schema.eventTeams)
    .innerJoin(schema.events, eq(schema.eventTeams.eventKey, schema.events.key))
    .where(and(eq(schema.eventTeams.teamKey, teamKey), eq(schema.events.year, seasonYear)))
    .limit(1);
  if (existing) return;

  try {
    const eventKeys = await tbaClient.getTeamEventsForYear(teamKey, seasonYear);
    for (const eventKey of eventKeys) {
      await ensureEventCached(eventKey);
      await db.insert(schema.eventTeams).values({ eventKey, teamKey }).onConflictDoNothing();
    }
  } catch (err) {
    logger.warn("failed to lazily fetch team events for year", { teamKey, seasonYear, error: String(err) });
  }
}

/**
 * Resolves exactly which (teamKey, eventKey) pairs count toward a league's score,
 * scoped to the roster team keys the caller passes in. Never queries team_event_scores
 * or event_teams by a bare `teamKey IN (...)` without also constraining to this
 * league's own event scope — a team can be rostered in other leagues scoped to
 * different events, and that data must never leak in here.
 */
export async function resolveTeamEventPairs(
  league: League,
  rosterTeamKeys: string[],
): Promise<TeamEventPair[]> {
  if (rosterTeamKeys.length === 0) return [];

  if (league.temporalTopology !== "season_long") {
    if (!league.tbaEventKey) throw new Error("event-scoped league missing tbaEventKey");
    const eventKey = league.tbaEventKey;
    return rosterTeamKeys.map((teamKey) => ({ teamKey, eventKey }));
  }

  if (league.spatialTopology === "district") {
    if (!league.districtKey) throw new Error("district league missing districtKey");

    await ensureEventsForYearCached(league.seasonYear);
    const districtEvents = await db
      .select({ key: schema.events.key })
      .from(schema.events)
      .where(and(eq(schema.events.districtKey, league.districtKey), eq(schema.events.year, league.seasonYear)));
    for (const e of districtEvents) {
      await ensureEventTeamsCached(e.key);
    }

    return db
      .select({ teamKey: schema.eventTeams.teamKey, eventKey: schema.eventTeams.eventKey })
      .from(schema.eventTeams)
      .innerJoin(schema.events, eq(schema.eventTeams.eventKey, schema.events.key))
      .where(
        and(
          eq(schema.events.districtKey, league.districtKey),
          eq(schema.events.year, league.seasonYear),
          inArray(schema.eventTeams.teamKey, rosterTeamKeys),
        ),
      );
  }

  // global season-long
  for (const teamKey of rosterTeamKeys) {
    await ensureTeamEventsCached(teamKey, league.seasonYear);
  }

  return db
    .select({ teamKey: schema.eventTeams.teamKey, eventKey: schema.eventTeams.eventKey })
    .from(schema.eventTeams)
    .innerJoin(schema.events, eq(schema.eventTeams.eventKey, schema.events.key))
    .where(and(eq(schema.events.year, league.seasonYear), inArray(schema.eventTeams.teamKey, rosterTeamKeys)));
}
