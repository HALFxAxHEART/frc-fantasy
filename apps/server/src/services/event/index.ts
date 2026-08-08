import { db, schema } from "@frc-fantasy/db";
import { and, eq, gte, ilike, or } from "drizzle-orm";
import { tbaClient } from "../../ingestion/tba-client";
import { createLogger } from "../../lib/logger";

const logger = createLogger("service:event");

export async function ensureEventsForYearCached(year: number) {
  const [existing] = await db
    .select({ key: schema.events.key })
    .from(schema.events)
    .where(eq(schema.events.year, year))
    .limit(1);
  if (existing) return;

  try {
    const events = await tbaClient.getEventsByYear(year);
    for (const e of events) {
      await db
        .insert(schema.events)
        .values({
          key: e.key,
          name: e.name,
          shortName: e.short_name,
          eventType: e.event_type,
          districtKey: e.district?.key ?? null,
          city: e.city,
          stateProv: e.state_prov,
          country: e.country,
          startDate: e.start_date,
          endDate: e.end_date,
          year: e.year,
          week: e.week,
          timezone: e.timezone,
          website: e.website,
          webcasts: e.webcasts,
        })
        .onConflictDoNothing();
    }
  } catch (err) {
    logger.warn("failed to lazily fetch events for year", { year, error: String(err) });
  }
}

export async function searchEvents(query?: string, year?: number, districtKey?: string) {
  if (year) await ensureEventsForYearCached(year);

  const conditions = [];
  if (query) conditions.push(or(ilike(schema.events.name, `%${query}%`), ilike(schema.events.key, `%${query}%`)));
  if (year) conditions.push(eq(schema.events.year, year));
  if (districtKey) conditions.push(eq(schema.events.districtKey, districtKey));

  return db
    .select()
    .from(schema.events)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(schema.events.startDate)
    .limit(100);
}

export async function listUpcomingEvents(year?: number) {
  const targetYear = year ?? new Date().getFullYear();
  await ensureEventsForYearCached(targetYear);

  const today = new Date().toISOString().slice(0, 10);
  return db
    .select()
    .from(schema.events)
    .where(and(eq(schema.events.year, targetYear), gte(schema.events.startDate, today)))
    .orderBy(schema.events.startDate)
    .limit(100);
}

export async function ensureEventTeamsCached(eventKey: string) {
  const [existing] = await db
    .select({ teamKey: schema.eventTeams.teamKey })
    .from(schema.eventTeams)
    .where(eq(schema.eventTeams.eventKey, eventKey))
    .limit(1);

  if (existing) return;

  try {
    const teamKeys = await tbaClient.getEventTeamKeys(eventKey);
    for (const teamKey of teamKeys) {
      await db.insert(schema.eventTeams).values({ eventKey, teamKey }).onConflictDoNothing();
    }
  } catch (err) {
    logger.warn("failed to lazily fetch event teams", { eventKey, error: String(err) });
  }
}

export async function getEventTeams(eventKey: string) {
  await ensureEventTeamsCached(eventKey);

  return db
    .select({ team: schema.teams })
    .from(schema.eventTeams)
    .innerJoin(schema.teams, eq(schema.eventTeams.teamKey, schema.teams.key))
    .where(eq(schema.eventTeams.eventKey, eventKey))
    .orderBy(schema.teams.teamNumber);
}
