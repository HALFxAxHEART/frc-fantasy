import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { leagueMembers, leagues } from "./leagues";
import { teams } from "./tba-cache";

export const draftTypeEnum = pgEnum("draft_type", ["snake"]);
export const draftStatusEnum = pgEnum("draft_status", [
  "scheduled",
  "in_progress",
  "paused",
  "completed",
]);

export const drafts = pgTable("drafts", {
  id: uuid("id").primaryKey().defaultRandom(),
  leagueId: uuid("league_id")
    .notNull()
    .unique()
    .references(() => leagues.id, { onDelete: "cascade" }),
  draftType: draftTypeEnum("draft_type").notNull().default("snake"),
  status: draftStatusEnum("status").notNull().default("scheduled"),
  scheduledStartAt: timestamp("scheduled_start_at", { withTimezone: true }),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  currentPickNumber: integer("current_pick_number").notNull().default(1),
  secondsPerPick: integer("seconds_per_pick").notNull().default(90),
  /** Ordered array of league_member ids, one full round of the snake order. */
  pickOrder: jsonb("pick_order").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const draftPicks = pgTable(
  "draft_picks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    draftId: uuid("draft_id")
      .notNull()
      .references(() => drafts.id, { onDelete: "cascade" }),
    pickNumber: integer("pick_number").notNull(),
    round: integer("round").notNull(),
    leagueMemberId: uuid("league_member_id")
      .notNull()
      .references(() => leagueMembers.id),
    teamKey: text("team_key").references(() => teams.key),
    madeAt: timestamp("made_at", { withTimezone: true }),
    isAutopick: boolean("is_autopick").notNull().default(false),
  },
  (t) => [unique("draft_picks_draft_pick_number_unique").on(t.draftId, t.pickNumber)],
);

export const draftsRelations = relations(drafts, ({ one, many }) => ({
  league: one(leagues, { fields: [drafts.leagueId], references: [leagues.id] }),
  picks: many(draftPicks),
}));

export const draftPicksRelations = relations(draftPicks, ({ one }) => ({
  draft: one(drafts, { fields: [draftPicks.draftId], references: [drafts.id] }),
  member: one(leagueMembers, {
    fields: [draftPicks.leagueMemberId],
    references: [leagueMembers.id],
  }),
  team: one(teams, { fields: [draftPicks.teamKey], references: [teams.key] }),
}));
