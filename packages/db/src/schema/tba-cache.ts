import {
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/**
 * TBA-sourced entities key off TBA's own natural keys (e.g. "frc5090", "2026mifim")
 * instead of a synthetic uuid. Daily ingestion upserts by that key, so re-running the
 * job is always idempotent and there's no separate id-mapping table to keep in sync.
 */

export const teams = pgTable("teams", {
  key: text("key").primaryKey(), // e.g. "frc5090"
  teamNumber: integer("team_number").notNull().unique(),
  nickname: text("nickname"),
  name: text("name"), // full sponsor/school name
  city: text("city"),
  stateProv: text("state_prov"),
  country: text("country"),
  rookieYear: integer("rookie_year"),
  website: text("website"),
  motto: text("motto"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Most TBA media types (imgur, youtube, cdphotothread, ...) come back with a public
 * direct_url — we cache only the URL + metadata and let the browser hit that CDN
 * directly. The "avatar" type is the exception: TBA returns it as base64 PNG in the
 * response body with no stable CDN URL, so that one gets its bytes stored in
 * avatarBlob and is served back through our own /api/teams/:teamKey/avatar route.
 */
export const teamMedia = pgTable(
  "team_media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamKey: text("team_key")
      .notNull()
      .references(() => teams.key, { onDelete: "cascade" }),
    year: integer("year").notNull(),
    mediaType: text("media_type").notNull(), // TBA's type string, e.g. "avatar", "imgur", "youtube"
    directUrl: text("direct_url"),
    avatarBlob: text("avatar_blob"), // base64 PNG bytes for mediaType="avatar"
    avatarContentType: text("avatar_content_type"),
    tbaForeignKey: text("tba_foreign_key"),
    cachedAt: timestamp("cached_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("team_media_unique").on(t.teamKey, t.year, t.mediaType, t.tbaForeignKey),
    index("team_media_team_year_idx").on(t.teamKey, t.year),
  ],
);

export const districts = pgTable("districts", {
  key: text("key").primaryKey(), // e.g. "2026fim"
  abbreviation: text("abbreviation").notNull(),
  displayName: text("display_name").notNull(),
  year: integer("year").notNull(),
});

export const events = pgTable(
  "events",
  {
    key: text("key").primaryKey(), // e.g. "2026mifim"
    name: text("name").notNull(),
    shortName: text("short_name"),
    eventType: integer("event_type").notNull(),
    districtKey: text("district_key").references(() => districts.key),
    city: text("city"),
    stateProv: text("state_prov"),
    country: text("country"),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    year: integer("year").notNull(),
    week: integer("week"),
    timezone: text("timezone"),
    website: text("website"),
    webcasts: jsonb("webcasts").$type<{ type: string; channel: string }[]>(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("events_year_idx").on(t.year), index("events_district_idx").on(t.districtKey)],
);

/** The attendee list a Weekly Event Draft league drafts from. */
export const eventTeams = pgTable(
  "event_teams",
  {
    eventKey: text("event_key")
      .notNull()
      .references(() => events.key, { onDelete: "cascade" }),
    teamKey: text("team_key")
      .notNull()
      .references(() => teams.key, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.eventKey, t.teamKey] })],
);

export const matches = pgTable(
  "matches",
  {
    key: text("key").primaryKey(), // e.g. "2026mifim_qm1"
    eventKey: text("event_key")
      .notNull()
      .references(() => events.key, { onDelete: "cascade" }),
    compLevel: text("comp_level").notNull(), // qm, ef, qf, sf, f
    setNumber: integer("set_number").notNull(),
    matchNumber: integer("match_number").notNull(),
    redTeams: jsonb("red_teams").$type<string[]>().notNull(),
    blueTeams: jsonb("blue_teams").$type<string[]>().notNull(),
    redScore: integer("red_score"),
    blueScore: integer("blue_score"),
    winningAlliance: text("winning_alliance"), // "red" | "blue" | "" (tie)
    scoreBreakdown: jsonb("score_breakdown"),
    actualTime: timestamp("actual_time", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("matches_event_idx").on(t.eventKey)],
);

export const rankings = pgTable(
  "rankings",
  {
    eventKey: text("event_key")
      .notNull()
      .references(() => events.key, { onDelete: "cascade" }),
    teamKey: text("team_key")
      .notNull()
      .references(() => teams.key, { onDelete: "cascade" }),
    rank: integer("rank").notNull(),
    rankingPoints: numeric("ranking_points").notNull(),
    wins: integer("wins").notNull(),
    losses: integer("losses").notNull(),
    ties: integer("ties").notNull(),
    played: integer("played").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.eventKey, t.teamKey] })],
);

export const oprs = pgTable(
  "oprs",
  {
    eventKey: text("event_key")
      .notNull()
      .references(() => events.key, { onDelete: "cascade" }),
    teamKey: text("team_key")
      .notNull()
      .references(() => teams.key, { onDelete: "cascade" }),
    opr: numeric("opr").notNull(),
    dpr: numeric("dpr").notNull(),
    ccwm: numeric("ccwm").notNull(),
  },
  (t) => [primaryKey({ columns: [t.eventKey, t.teamKey] })],
);

/** Time series powering the OPR/EPA trajectory chart on the Analytics Hub profile. */
export const epaSnapshots = pgTable(
  "epa_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamKey: text("team_key")
      .notNull()
      .references(() => teams.key, { onDelete: "cascade" }),
    year: integer("year").notNull(),
    eventKey: text("event_key").references(() => events.key), // null = season-to-date
    epaMean: numeric("epa_mean").notNull(),
    epaMax: numeric("epa_max"),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
    source: text("source").notNull().default("statbotics"),
  },
  (t) => [index("epa_snapshots_team_year_idx").on(t.teamKey, t.year)],
);

export const awards = pgTable(
  "awards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamKey: text("team_key")
      .notNull()
      .references(() => teams.key, { onDelete: "cascade" }),
    eventKey: text("event_key")
      .notNull()
      .references(() => events.key, { onDelete: "cascade" }),
    awardType: integer("award_type").notNull(),
    name: text("name").notNull(),
    year: integer("year").notNull(),
    recipientName: text("recipient_name"), // set for individual-recipient awards
  },
  (t) => [
    unique("awards_unique").on(t.eventKey, t.awardType, t.teamKey, t.recipientName),
    index("awards_team_idx").on(t.teamKey),
  ],
);

/**
 * Pre-aggregated rollup populated during ingestion so an Analytics Hub profile page
 * is a single indexed read instead of aggregating matches/OPR on every request.
 */
export const teamYearStats = pgTable(
  "team_year_stats",
  {
    teamKey: text("team_key")
      .notNull()
      .references(() => teams.key, { onDelete: "cascade" }),
    year: integer("year").notNull(),
    wins: integer("wins").notNull().default(0),
    losses: integer("losses").notNull().default(0),
    ties: integer("ties").notNull().default(0),
    eventsPlayed: integer("events_played").notNull().default(0),
    avgOpr: numeric("avg_opr"),
    avgEpa: numeric("avg_epa"),
  },
  (t) => [primaryKey({ columns: [t.teamKey, t.year] })],
);

export const teamsRelations = relations(teams, ({ many }) => ({
  media: many(teamMedia),
  eventTeams: many(eventTeams),
  rankings: many(rankings),
  oprs: many(oprs),
  epaSnapshots: many(epaSnapshots),
  awards: many(awards),
  yearStats: many(teamYearStats),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  district: one(districts, { fields: [events.districtKey], references: [districts.key] }),
  eventTeams: many(eventTeams),
  matches: many(matches),
  rankings: many(rankings),
  oprs: many(oprs),
  awards: many(awards),
}));

export const eventTeamsRelations = relations(eventTeams, ({ one }) => ({
  event: one(events, { fields: [eventTeams.eventKey], references: [events.key] }),
  team: one(teams, { fields: [eventTeams.teamKey], references: [teams.key] }),
}));

export const matchesRelations = relations(matches, ({ one }) => ({
  event: one(events, { fields: [matches.eventKey], references: [events.key] }),
}));
