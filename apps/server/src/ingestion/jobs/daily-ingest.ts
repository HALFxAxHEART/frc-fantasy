import { db, schema } from "@frc-fantasy/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { createLogger } from "../../lib/logger";
import { syncEventDistrictPoints } from "../../services/scoring/team-event-scores";
import { tbaClient, type TbaEvent } from "../tba-client";

const logger = createLogger("jobs:daily-ingest");

function currentSeasonYear(): number {
  return new Date().getFullYear();
}

async function upsertTeam(t: Awaited<ReturnType<typeof tbaClient.getTeam>>) {
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
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: schema.teams.key,
      set: {
        nickname: t.nickname,
        name: t.name,
        city: t.city,
        stateProv: t.state_prov,
        country: t.country,
        rookieYear: t.rookie_year,
        website: t.website,
        motto: t.motto,
        updatedAt: new Date(),
      },
    });
}

async function syncTeams(year: number): Promise<number> {
  let page = 0;
  let total = 0;
  for (;;) {
    const teams = await tbaClient.getTeamsPage(year, page);
    if (teams.length === 0) break;
    for (const t of teams) await upsertTeam(t);
    total += teams.length;
    page += 1;
  }
  logger.info("synced teams", { year, total });
  return total;
}

async function syncDistricts(year: number): Promise<string[]> {
  const districts = await tbaClient.getDistricts(year);
  for (const d of districts) {
    await db
      .insert(schema.districts)
      .values({ key: d.key, abbreviation: d.abbreviation, displayName: d.display_name, year: d.year })
      .onConflictDoUpdate({
        target: schema.districts.key,
        set: { abbreviation: d.abbreviation, displayName: d.display_name },
      });
  }
  logger.info("synced districts", { year, total: districts.length });
  return districts.map((d) => d.key);
}

async function upsertEvent(e: TbaEvent) {
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
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: schema.events.key,
      set: {
        name: e.name,
        shortName: e.short_name,
        districtKey: e.district?.key ?? null,
        city: e.city,
        stateProv: e.state_prov,
        country: e.country,
        startDate: e.start_date,
        endDate: e.end_date,
        week: e.week,
        webcasts: e.webcasts,
        updatedAt: new Date(),
      },
    });
}

async function syncEvents(year: number): Promise<TbaEvent[]> {
  const events = await tbaClient.getEventsByYear(year);
  for (const e of events) await upsertEvent(e);
  logger.info("synced events", { year, total: events.length });
  return events;
}

/** Active window: starts within a day or ends within the last 3 days. */
function isInActiveWindow(event: TbaEvent, today: Date): boolean {
  const start = new Date(event.start_date);
  const end = new Date(event.end_date);
  const windowStart = new Date(start);
  windowStart.setDate(windowStart.getDate() - 1);
  const windowEnd = new Date(end);
  windowEnd.setDate(windowEnd.getDate() + 3);
  return today >= windowStart && today <= windowEnd;
}

async function leagueReferencedEventKeys(): Promise<Set<string>> {
  const rows = await db
    .select({ tbaEventKey: schema.leagues.tbaEventKey, districtKey: schema.leagues.districtKey })
    .from(schema.leagues);

  const eventKeys = new Set<string>();
  const districtKeys = new Set<string>();
  for (const row of rows) {
    if (row.tbaEventKey) eventKeys.add(row.tbaEventKey);
    if (row.districtKey) districtKeys.add(row.districtKey);
  }
  if (districtKeys.size > 0) {
    const districtEvents = await db
      .select({ key: schema.events.key })
      .from(schema.events)
      .where(inArray(schema.events.districtKey, [...districtKeys]));
    for (const e of districtEvents) eventKeys.add(e.key);
  }
  return eventKeys;
}

async function syncEventDetail(eventKey: string): Promise<Set<string>> {
  const touchedTeamKeys = new Set<string>();

  const teamKeys = await tbaClient.getEventTeamKeys(eventKey);
  for (const teamKey of teamKeys) {
    await db
      .insert(schema.eventTeams)
      .values({ eventKey, teamKey })
      .onConflictDoNothing();
    touchedTeamKeys.add(teamKey);
  }

  const matches = await tbaClient.getEventMatches(eventKey);
  for (const m of matches) {
    await db
      .insert(schema.matches)
      .values({
        key: m.key,
        eventKey: m.event_key,
        compLevel: m.comp_level,
        setNumber: m.set_number,
        matchNumber: m.match_number,
        redTeams: m.alliances.red.team_keys,
        blueTeams: m.alliances.blue.team_keys,
        redScore: m.alliances.red.score >= 0 ? m.alliances.red.score : null,
        blueScore: m.alliances.blue.score >= 0 ? m.alliances.blue.score : null,
        winningAlliance: m.winning_alliance || null,
        scoreBreakdown: m.score_breakdown,
        actualTime: m.actual_time ? new Date(m.actual_time * 1000) : null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.matches.key,
        set: {
          redScore: m.alliances.red.score >= 0 ? m.alliances.red.score : null,
          blueScore: m.alliances.blue.score >= 0 ? m.alliances.blue.score : null,
          winningAlliance: m.winning_alliance || null,
          scoreBreakdown: m.score_breakdown,
          actualTime: m.actual_time ? new Date(m.actual_time * 1000) : null,
          updatedAt: new Date(),
        },
      });
    for (const teamKey of [...m.alliances.red.team_keys, ...m.alliances.blue.team_keys]) {
      touchedTeamKeys.add(teamKey);
    }
  }

  try {
    // TBA returns a bare null body (not {rankings: null}) for an event that hasn't
    // started ranking play yet — not fatal, same as the OPR call below.
    const rankingResponse = await tbaClient.getEventRankings(eventKey);
    for (const r of rankingResponse?.rankings ?? []) {
      await db
        .insert(schema.rankings)
        .values({
          eventKey,
          teamKey: r.team_key,
          rank: r.rank,
          rankingPoints: String(r.sort_orders?.[0] ?? 0),
          wins: r.record?.wins ?? 0,
          losses: r.record?.losses ?? 0,
          ties: r.record?.ties ?? 0,
          played: r.matches_played,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [schema.rankings.eventKey, schema.rankings.teamKey],
          set: {
            rank: r.rank,
            rankingPoints: String(r.sort_orders?.[0] ?? 0),
            wins: r.record?.wins ?? 0,
            losses: r.record?.losses ?? 0,
            ties: r.record?.ties ?? 0,
            played: r.matches_played,
            updatedAt: new Date(),
          },
        });
    }
  } catch (err) {
    logger.warn("rankings unavailable for event", { eventKey, error: String(err) });
  }

  try {
    const oprResponse = await tbaClient.getEventOprs(eventKey);
    for (const teamKey of Object.keys(oprResponse.oprs ?? {})) {
      await db
        .insert(schema.oprs)
        .values({
          eventKey,
          teamKey,
          opr: String(oprResponse.oprs[teamKey] ?? 0),
          dpr: String(oprResponse.dprs?.[teamKey] ?? 0),
          ccwm: String(oprResponse.ccwms?.[teamKey] ?? 0),
        })
        .onConflictDoUpdate({
          target: [schema.oprs.eventKey, schema.oprs.teamKey],
          set: {
            opr: String(oprResponse.oprs[teamKey] ?? 0),
            dpr: String(oprResponse.dprs?.[teamKey] ?? 0),
            ccwm: String(oprResponse.ccwms?.[teamKey] ?? 0),
          },
        });
    }
  } catch (err) {
    // OPRs are unavailable for events with too few qual matches played yet — not fatal.
    logger.warn("oprs unavailable for event", { eventKey, error: String(err) });
  }

  const awards = await tbaClient.getEventAwards(eventKey);
  for (const a of awards) {
    for (const recipient of a.recipient_list) {
      if (!recipient.team_key) continue;
      await db
        .insert(schema.awards)
        .values({
          teamKey: recipient.team_key,
          eventKey: a.event_key,
          awardType: a.award_type,
          name: a.name,
          year: a.year,
          recipientName: recipient.awardee,
        })
        .onConflictDoNothing();
      touchedTeamKeys.add(recipient.team_key);
    }
  }

  await syncEventDistrictPoints(eventKey);

  return touchedTeamKeys;
}

/** Rolls up wins/losses/ties/events_played/avg OPR per team-year from what we just ingested. */
async function refreshTeamYearStats(year: number, teamKeys: Set<string>) {
  if (teamKeys.size === 0) return;
  for (const teamKey of teamKeys) {
    const matchRows = await db
      .select({
        redTeams: schema.matches.redTeams,
        blueTeams: schema.matches.blueTeams,
        winningAlliance: schema.matches.winningAlliance,
        eventKey: schema.matches.eventKey,
      })
      .from(schema.matches)
      .innerJoin(schema.events, eq(schema.matches.eventKey, schema.events.key))
      .where(and(eq(schema.events.year, year), sql`${schema.matches.compLevel} = 'qm'`));

    let wins = 0;
    let losses = 0;
    let ties = 0;
    const eventsSeen = new Set<string>();
    for (const m of matchRows) {
      const onRed = (m.redTeams as string[]).includes(teamKey);
      const onBlue = (m.blueTeams as string[]).includes(teamKey);
      if (!onRed && !onBlue) continue;
      eventsSeen.add(m.eventKey);
      if (!m.winningAlliance) continue;
      const won = (onRed && m.winningAlliance === "red") || (onBlue && m.winningAlliance === "blue");
      const lost = (onRed && m.winningAlliance === "blue") || (onBlue && m.winningAlliance === "red");
      if (won) wins += 1;
      else if (lost) losses += 1;
      else ties += 1;
    }

    const oprRows = await db
      .select({ opr: schema.oprs.opr })
      .from(schema.oprs)
      .innerJoin(schema.events, eq(schema.oprs.eventKey, schema.events.key))
      .where(and(eq(schema.events.year, year), eq(schema.oprs.teamKey, teamKey)));
    const avgOpr =
      oprRows.length > 0
        ? oprRows.reduce((sum, r) => sum + Number(r.opr), 0) / oprRows.length
        : null;

    await db
      .insert(schema.teamYearStats)
      .values({
        teamKey,
        year,
        wins,
        losses,
        ties,
        eventsPlayed: eventsSeen.size,
        avgOpr: avgOpr !== null ? String(avgOpr) : null,
      })
      .onConflictDoUpdate({
        target: [schema.teamYearStats.teamKey, schema.teamYearStats.year],
        set: { wins, losses, ties, eventsPlayed: eventsSeen.size, avgOpr: avgOpr !== null ? String(avgOpr) : null },
      });
  }
}

async function runDailyIngest() {
  const [run] = await db
    .insert(schema.ingestionRuns)
    .values({ jobName: "daily-ingest", status: "running" })
    .returning();
  if (!run) throw new Error("failed to create ingestion_runs row");

  try {
    const year = currentSeasonYear();
    const teamCount = await syncTeams(year);
    await syncDistricts(year);
    const events = await syncEvents(year);

    const today = new Date();
    const referenced = await leagueReferencedEventKeys();
    const eventsToSync = events.filter((e) => isInActiveWindow(e, today) || referenced.has(e.key));

    logger.info("events selected for detail sync", {
      total: events.length,
      selected: eventsToSync.length,
    });

    const touchedTeamKeys = new Set<string>();
    for (const event of eventsToSync) {
      const touched = await syncEventDetail(event.key);
      for (const k of touched) touchedTeamKeys.add(k);
    }

    await refreshTeamYearStats(year, touchedTeamKeys);

    await db
      .update(schema.ingestionRuns)
      .set({
        status: "success",
        finishedAt: new Date(),
        summary: {
          year,
          teamCount,
          eventCount: events.length,
          eventsSynced: eventsToSync.length,
          teamsRefreshed: touchedTeamKeys.size,
        },
      })
      .where(eq(schema.ingestionRuns.id, run.id));

    logger.info("daily ingest complete", { runId: run.id });
  } catch (error) {
    await db
      .update(schema.ingestionRuns)
      .set({ status: "failed", finishedAt: new Date(), errorMessage: String(error) })
      .where(eq(schema.ingestionRuns.id, run.id));
    logger.error("daily ingest failed", { runId: run.id, error: String(error) });
    throw error;
  }
}

if (import.meta.main) {
  await runDailyIngest();
  process.exit(0);
}

export { runDailyIngest };
