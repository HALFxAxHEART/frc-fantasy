import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";
import {
  check,
  integer,
  pgEnum,
  pgTable,
  smallint,
  text,
  time,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { districts, events, teams } from "./tba-cache";

export const spatialTopologyEnum = pgEnum("spatial_topology", ["global", "district"]);

/**
 * weekly_event_draft is a full peer of season_long/single_event, not a flag bolted
 * onto single_event — the create-league wizard shows it as its own third option, and
 * it's queryable everywhere (draft UI copy, standings) without inspecting a flag.
 */
export const temporalTopologyEnum = pgEnum("temporal_topology", [
  "season_long",
  "single_event",
  "weekly_event_draft",
]);

export const leagueStatusEnum = pgEnum("league_status", [
  "setup",
  "drafting",
  "active",
  "completed",
]);

export const leagueRoleEnum = pgEnum("league_role", ["commissioner", "manager"]);

export const rosterStatusEnum = pgEnum("roster_status", ["valid", "invalid_over_limit"]);

export const rosterAcquiredViaEnum = pgEnum("roster_acquired_via", [
  "draft",
  "trade",
  "commissioner_assign",
]);

export const leagues = pgTable(
  "leagues",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    inviteCode: text("invite_code").notNull().unique(),
    commissionerId: uuid("commissioner_id")
      .notNull()
      .references(() => users.id),
    spatialTopology: spatialTopologyEnum("spatial_topology").notNull(),
    districtKey: text("district_key").references(() => districts.key),
    temporalTopology: temporalTopologyEnum("temporal_topology").notNull(),
    tbaEventKey: text("tba_event_key").references(() => events.key),
    seasonYear: integer("season_year").notNull(),
    rosterSize: integer("roster_size").notNull().default(7),
    status: leagueStatusEnum("status").notNull().default("setup"),
    tradeWindowOpenDay: smallint("trade_window_open_day").notNull().default(1), // 1=Mon
    tradeWindowOpenTime: time("trade_window_open_time").notNull().default("08:00"),
    tradeWindowCloseDay: smallint("trade_window_close_day").notNull().default(3), // 3=Wed
    tradeWindowCloseTime: time("trade_window_close_time").notNull().default("23:59"),
    tradeWindowTimezone: text("trade_window_timezone").notNull().default("America/New_York"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      "district_key_required_for_district_leagues",
      sql`${t.spatialTopology} = 'global' OR ${t.districtKey} IS NOT NULL`,
    ),
    check(
      "event_key_required_for_event_leagues",
      sql`${t.temporalTopology} = 'season_long' OR ${t.tbaEventKey} IS NOT NULL`,
    ),
  ],
);

export const leagueMembers = pgTable(
  "league_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leagueId: uuid("league_id")
      .notNull()
      .references(() => leagues.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    role: leagueRoleEnum("role").notNull().default("manager"),
    teamName: text("team_name").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("league_members_league_user_unique").on(t.leagueId, t.userId)],
);

export const rosters = pgTable("rosters", {
  id: uuid("id").primaryKey().defaultRandom(),
  leagueMemberId: uuid("league_member_id")
    .notNull()
    .unique()
    .references(() => leagueMembers.id, { onDelete: "cascade" }),
  status: rosterStatusEnum("status").notNull().default("valid"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const rosterSlots = pgTable("roster_slots", {
  id: uuid("id").primaryKey().defaultRandom(),
  rosterId: uuid("roster_id")
    .notNull()
    .references(() => rosters.id, { onDelete: "cascade" }),
  teamKey: text("team_key")
    .notNull()
    .references(() => teams.key),
  acquiredVia: rosterAcquiredViaEnum("acquired_via").notNull(),
  acquiredAt: timestamp("acquired_at", { withTimezone: true }).notNull().defaultNow(),
  droppedAt: timestamp("dropped_at", { withTimezone: true }),
});

export const leaguesRelations = relations(leagues, ({ one, many }) => ({
  commissioner: one(users, { fields: [leagues.commissionerId], references: [users.id] }),
  district: one(districts, { fields: [leagues.districtKey], references: [districts.key] }),
  event: one(events, { fields: [leagues.tbaEventKey], references: [events.key] }),
  members: many(leagueMembers),
}));

export const leagueMembersRelations = relations(leagueMembers, ({ one }) => ({
  league: one(leagues, { fields: [leagueMembers.leagueId], references: [leagues.id] }),
  user: one(users, { fields: [leagueMembers.userId], references: [users.id] }),
  roster: one(rosters, { fields: [leagueMembers.id], references: [rosters.leagueMemberId] }),
}));

export const rostersRelations = relations(rosters, ({ one, many }) => ({
  member: one(leagueMembers, {
    fields: [rosters.leagueMemberId],
    references: [leagueMembers.id],
  }),
  slots: many(rosterSlots),
}));

export const rosterSlotsRelations = relations(rosterSlots, ({ one }) => ({
  roster: one(rosters, { fields: [rosterSlots.rosterId], references: [rosters.id] }),
}));
