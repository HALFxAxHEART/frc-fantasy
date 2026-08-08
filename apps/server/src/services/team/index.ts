import { db, schema } from "@frc-fantasy/db";
import { desc, eq, ilike, or, sql } from "drizzle-orm";
import { NotFoundError } from "../../lib/errors";
import { createLogger } from "../../lib/logger";
import { tbaClient } from "../../ingestion/tba-client";
import { statboticsClient } from "../../ingestion/statbotics-client";

const logger = createLogger("service:team");

function teamKeyFromNumber(teamNumber: number): string {
  return `frc${teamNumber}`;
}

/** Fetches and caches whatever's missing for a team the first time it's looked up. */
async function ensureTeamCached(teamNumber: number) {
  const teamKey = teamKeyFromNumber(teamNumber);

  let [team] = await db.select().from(schema.teams).where(eq(schema.teams.key, teamKey)).limit(1);
  if (!team) {
    const t = await tbaClient.getTeam(teamKey);
    await db
      .insert(schema.teams)
      .values({
        key: t.key,
        teamNumber: t.team_number,
        nickname: t.nickname,
        name: t.name,
        city: t.city,
        stateProv: t.state_prov,
        country: t.country,
        rookieYear: t.rookie_year,
        website: t.website,
        motto: t.motto,
      })
      .onConflictDoNothing();
    [team] = await db.select().from(schema.teams).where(eq(schema.teams.key, teamKey)).limit(1);
  }
  if (!team) throw new NotFoundError(`Team ${teamNumber}`);

  // Independent of each other — each already swallows its own errors internally
  // (logs + returns), so a slow/failing one can't block or fail the others. Run in
  // parallel: sequentially, a team with a long history could chain dozens of TBA/
  // Statbotics round-trips (see ensureHistoricalWinRateCached) and feel like it
  // hangs even with a per-call timeout.
  await Promise.all([
    ensureAvatarCached(teamKey),
    ensureEpaHistoryCached(teamNumber, teamKey),
    ensureAwardsCached(teamKey),
    ensureHistoricalWinRateCached(teamKey),
  ]);

  return team;
}

async function ensureAvatarCached(teamKey: string) {
  const currentYear = new Date().getFullYear();
  const [existing] = await db
    .select({ id: schema.teamMedia.id })
    .from(schema.teamMedia)
    .where(eq(schema.teamMedia.teamKey, teamKey))
    .limit(1);
  if (existing) return;

  try {
    const media = await tbaClient.getTeamMedia(teamKey, currentYear);
    for (const m of media) {
      const isAvatar = m.type === "avatar";
      await db
        .insert(schema.teamMedia)
        .values({
          teamKey,
          year: currentYear,
          mediaType: m.type,
          directUrl: !isAvatar ? (m.direct_url ?? m.view_url ?? null) : null,
          avatarBlob: isAvatar ? ((m.details?.base64Image as string | undefined) ?? null) : null,
          avatarContentType: isAvatar ? "image/png" : null,
          tbaForeignKey: m.foreign_key,
        })
        .onConflictDoNothing();
    }
  } catch (err) {
    logger.warn("failed to fetch team media", { teamKey, error: String(err) });
  }
}

/** One Statbotics call returns every year of EPA data — powers the trajectory chart. */
export async function ensureEpaHistoryCached(teamNumber: number, teamKey: string) {
  const [existing] = await db
    .select({ id: schema.epaSnapshots.id })
    .from(schema.epaSnapshots)
    .where(eq(schema.epaSnapshots.teamKey, teamKey))
    .limit(1);
  if (existing) return;

  try {
    const years = await statboticsClient.getTeamYears(teamNumber);
    for (const y of years) {
      if (!y.epa) continue;
      await db.insert(schema.epaSnapshots).values({
        teamKey,
        year: y.year,
        epaMean: String(y.epa.total_points),
        capturedAt: new Date(),
        source: "statbotics",
      });
    }
  } catch (err) {
    logger.warn("failed to fetch statbotics EPA history", { teamKey, error: String(err) });
  }
}

/**
 * awards.event_key is a real FK into events — an award for an event we haven't
 * ingested yet (common for historical awards from years we don't actively sync)
 * would otherwise fail that constraint. This backfills a minimal event row on demand.
 */
export async function ensureEventCached(eventKey: string) {
  const [existing] = await db
    .select({ key: schema.events.key })
    .from(schema.events)
    .where(eq(schema.events.key, eventKey))
    .limit(1);
  if (existing) return;

  const e = await tbaClient.getEvent(eventKey);

  // The event response embeds the full district object, so this needs no extra
  // TBA call — same reasoning as backfilling the event itself for an old award.
  if (e.district) {
    await db
      .insert(schema.districts)
      .values({
        key: e.district.key,
        abbreviation: e.district.abbreviation,
        displayName: e.district.display_name,
        year: e.district.year,
      })
      .onConflictDoNothing();
  }

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

/** One TBA call returns every award the team has ever won. */
async function ensureAwardsCached(teamKey: string) {
  const [existing] = await db
    .select({ id: schema.awards.id })
    .from(schema.awards)
    .where(eq(schema.awards.teamKey, teamKey))
    .limit(1);
  if (existing) return;

  try {
    const allAwards = await tbaClient.getTeamAwardsAll(teamKey);
    const eventKeys = [...new Set(allAwards.map((a) => a.event_key))];

    // A team with a long history can have awards spread across dozens of events —
    // backfilling those event stubs one at a time (each its own TBA round-trip) was
    // the single biggest contributor to a profile lookup feeling hung.
    const cachedEventKeys = new Set<string>();
    await Promise.all(
      eventKeys.map(async (eventKey) => {
        try {
          await ensureEventCached(eventKey);
          cachedEventKeys.add(eventKey);
        } catch (err) {
          logger.warn("failed to backfill event stub for award", { eventKey, error: String(err) });
        }
      }),
    );

    for (const a of allAwards) {
      if (!cachedEventKeys.has(a.event_key)) continue;
      const recipient = a.recipient_list.find((r) => r.team_key === teamKey) ?? a.recipient_list[0];
      await db
        .insert(schema.awards)
        .values({
          teamKey,
          eventKey: a.event_key,
          awardType: a.award_type,
          name: a.name,
          year: a.year,
          recipientName: recipient?.awardee ?? null,
        })
        .onConflictDoNothing();
    }
  } catch (err) {
    logger.warn("failed to fetch team awards", { teamKey, error: String(err) });
  }
}

/**
 * Backfills win/loss/tie history year by year via TBA's lightweight "simple" match
 * endpoint. Only runs once per team (subsequent profile views read from the DB), and
 * every underlying request is ETag-cached, so repeat ingestion runs are nearly free.
 */
async function ensureHistoricalWinRateCached(teamKey: string) {
  const [existing] = await db
    .select({ teamKey: schema.teamYearStats.teamKey })
    .from(schema.teamYearStats)
    .where(eq(schema.teamYearStats.teamKey, teamKey))
    .limit(1);
  if (existing) return;

  try {
    const years = await tbaClient.getTeamYearsParticipated(teamKey);

    // Each year's matches are an independent TBA round-trip — a long-tenured team
    // (Team RUSH-style, 25+ years) sequentially chained dozens of these and was the
    // single biggest contributor to a profile lookup feeling hung.
    await Promise.all(
      years.map(async (year) => {
        try {
          const matches = await tbaClient.getTeamMatchesSimpleForYear(teamKey, year);
          let wins = 0;
          let losses = 0;
          let ties = 0;
          const eventsSeen = new Set<string>();
          for (const m of matches) {
            if (m.comp_level !== "qm") continue;
            const onRed = m.alliances.red.team_keys.includes(teamKey);
            const onBlue = m.alliances.blue.team_keys.includes(teamKey);
            if (!onRed && !onBlue) continue;
            eventsSeen.add(m.event_key);
            if (!m.winning_alliance) continue;
            const won = (onRed && m.winning_alliance === "red") || (onBlue && m.winning_alliance === "blue");
            const lost = (onRed && m.winning_alliance === "blue") || (onBlue && m.winning_alliance === "red");
            if (won) wins += 1;
            else if (lost) losses += 1;
            else ties += 1;
          }
          await db
            .insert(schema.teamYearStats)
            .values({ teamKey, year, wins, losses, ties, eventsPlayed: eventsSeen.size })
            .onConflictDoNothing();
        } catch (err) {
          logger.warn("failed to backfill historical win rate for year", { teamKey, year, error: String(err) });
        }
      }),
    );
  } catch (err) {
    logger.warn("failed to backfill historical win rate", { teamKey, error: String(err) });
  }
}

export async function searchTeams(query: string) {
  const trimmed = query.trim();
  const asNumber = Number(trimmed);

  if (Number.isInteger(asNumber) && asNumber > 0) {
    const teamKey = teamKeyFromNumber(asNumber);
    const [existing] = await db.select().from(schema.teams).where(eq(schema.teams.key, teamKey)).limit(1);
    if (existing) return [existing];
    try {
      const team = await ensureTeamCached(asNumber);
      return [team];
    } catch {
      return [];
    }
  }

  return db
    .select()
    .from(schema.teams)
    .where(or(ilike(schema.teams.nickname, `%${trimmed}%`), ilike(schema.teams.name, `%${trimmed}%`)))
    .orderBy(schema.teams.teamNumber)
    .limit(25);
}

export async function getTeamProfile(teamNumber: number) {
  const team = await ensureTeamCached(teamNumber);
  const teamKey = team.key;

  const [media, yearStats, epaHistory, awards] = await Promise.all([
    db.select().from(schema.teamMedia).where(eq(schema.teamMedia.teamKey, teamKey)),
    db
      .select()
      .from(schema.teamYearStats)
      .where(eq(schema.teamYearStats.teamKey, teamKey))
      .orderBy(schema.teamYearStats.year),
    db
      .select()
      .from(schema.epaSnapshots)
      .where(eq(schema.epaSnapshots.teamKey, teamKey))
      .orderBy(schema.epaSnapshots.year),
    db
      .select()
      .from(schema.awards)
      .where(eq(schema.awards.teamKey, teamKey))
      .orderBy(desc(schema.awards.year)),
  ]);

  const avatar = media.find((m) => m.mediaType === "avatar");

  return {
    team,
    avatarUrl: avatar ? `/api/teams/${teamKey}/avatar` : null,
    media: media.filter((m) => m.mediaType !== "avatar"),
    yearStats,
    epaHistory,
    awards,
  };
}

export async function getTeamYearStats(teamNumber: number) {
  const teamKey = teamKeyFromNumber(teamNumber);
  return db
    .select()
    .from(schema.teamYearStats)
    .where(eq(schema.teamYearStats.teamKey, teamKey))
    .orderBy(schema.teamYearStats.year);
}

export interface TeamDistrictPointsSeason {
  year: number;
  totalPoints: number;
  eventCount: number;
}

/**
 * Sourced from team_event_scores — the same TBA-authoritative district points cache
 * the scoring engine populates. Only reflects events already synced (via the daily
 * cron's active-window pass, a league that references them, or a league's standings
 * computation touching this team) — no additional career-wide backfill here, since
 * a heavily-decorated team can have 100+ historical events and this page is already
 * the slowest one in the app on a cold cache.
 */
export async function getTeamDistrictPoints(teamNumber: number): Promise<{
  seasons: TeamDistrictPointsSeason[];
  averagePerSeason: number | null;
}> {
  const teamKey = teamKeyFromNumber(teamNumber);

  const rows = await db
    .select({
      year: schema.events.year,
      totalPoints: schema.teamEventScores.totalPoints,
    })
    .from(schema.teamEventScores)
    .innerJoin(schema.events, eq(schema.teamEventScores.eventKey, schema.events.key))
    .where(eq(schema.teamEventScores.teamKey, teamKey));

  const byYear = new Map<number, { totalPoints: number; eventCount: number }>();
  for (const row of rows) {
    const existing = byYear.get(row.year) ?? { totalPoints: 0, eventCount: 0 };
    existing.totalPoints += Number(row.totalPoints);
    existing.eventCount += 1;
    byYear.set(row.year, existing);
  }

  const seasons = [...byYear.entries()]
    .map(([year, v]) => ({ year, totalPoints: v.totalPoints, eventCount: v.eventCount }))
    .sort((a, b) => b.year - a.year);

  const averagePerSeason =
    seasons.length > 0 ? seasons.reduce((sum, s) => sum + s.totalPoints, 0) / seasons.length : null;

  return { seasons, averagePerSeason };
}

export async function getTeamAwards(teamNumber: number) {
  const teamKey = teamKeyFromNumber(teamNumber);
  return db
    .select()
    .from(schema.awards)
    .where(eq(schema.awards.teamKey, teamKey))
    .orderBy(desc(schema.awards.year));
}

export async function getTeamAvatar(teamKey: string): Promise<{ blob: string; contentType: string } | null> {
  const [media] = await db
    .select()
    .from(schema.teamMedia)
    .where(sql`${schema.teamMedia.teamKey} = ${teamKey} AND ${schema.teamMedia.mediaType} = 'avatar'`)
    .limit(1);
  if (!media?.avatarBlob) return null;
  return { blob: media.avatarBlob, contentType: media.avatarContentType ?? "image/png" };
}
