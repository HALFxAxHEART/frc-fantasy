import { db, schema } from "@frc-fantasy/db";
import { desc, eq, sql } from "drizzle-orm";
import { createLogger } from "../../lib/logger";
import { runDailyIngest } from "../../ingestion/jobs/daily-ingest";

const logger = createLogger("service:admin");

export async function listAllLeagues() {
  const rows = await db
    .select({
      league: schema.leagues,
      commissionerEmail: schema.users.email,
      commissionerName: schema.users.displayName,
    })
    .from(schema.leagues)
    .innerJoin(schema.users, eq(schema.leagues.commissionerId, schema.users.id))
    .orderBy(desc(schema.leagues.createdAt));

  const counts = await db
    .select({ leagueId: schema.leagueMembers.leagueId, count: sql<number>`count(*)::int` })
    .from(schema.leagueMembers)
    .groupBy(schema.leagueMembers.leagueId);
  const countByLeague = new Map(counts.map((c) => [c.leagueId, c.count]));

  return rows.map((r) => ({
    ...r.league,
    commissionerEmail: r.commissionerEmail,
    commissionerName: r.commissionerName,
    memberCount: countByLeague.get(r.league.id) ?? 0,
  }));
}

/**
 * Fire-and-forget — a full sync can take anywhere from a couple seconds to well
 * over a minute depending on how many events are in their active window, and
 * blocking an admin's click on that risks the exact "looks hung" failure mode
 * this session already root-caused and fixed for team profiles. The admin panel
 * polls getRecentSyncRuns() to watch it land instead.
 */
export function triggerSync(): void {
  logger.info("admin-triggered manual sync starting");
  runDailyIngest().catch((err) => logger.error("admin-triggered sync failed", { error: String(err) }));
}

export async function getRecentSyncRuns(limit = 10) {
  return db.select().from(schema.ingestionRuns).orderBy(desc(schema.ingestionRuns.startedAt)).limit(limit);
}
