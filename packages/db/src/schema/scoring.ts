import { relations } from "drizzle-orm";
import { index, integer, numeric, pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { leagueMembers, leagues } from "./leagues";
import { events, teams } from "./tba-cache";

export const tiebreakerEnum = pgEnum("tiebreaker_stat", ["avg_raw_alliance_score", "opr"]);

export const scoringRulesets = pgTable("scoring_rulesets", {
  id: uuid("id").primaryKey().defaultRandom(),
  leagueId: uuid("league_id")
    .notNull()
    .unique()
    .references(() => leagues.id, { onDelete: "cascade" }),
  rookieBonusFirstYear: integer("rookie_bonus_first_year").notNull().default(10),
  rookieBonusSecondYear: integer("rookie_bonus_second_year").notNull().default(5),
  tiebreaker1: tiebreakerEnum("tiebreaker_1").notNull().default("avg_raw_alliance_score"),
  tiebreaker2: tiebreakerEnum("tiebreaker_2").notNull().default("opr"),
  formulaVersion: text("formula_version").notNull().default("first_district_v1"),
});

/**
 * Raw per-team FIRST District Points at an event, independent of any fantasy league —
 * computed once, reused by every league that happens to have that team rostered.
 */
export const teamEventScores = pgTable(
  "team_event_scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamKey: text("team_key")
      .notNull()
      .references(() => teams.key, { onDelete: "cascade" }),
    eventKey: text("event_key")
      .notNull()
      .references(() => events.key, { onDelete: "cascade" }),
    qualificationPoints: numeric("qualification_points").notNull().default("0"),
    allianceSelectionPoints: numeric("alliance_selection_points").notNull().default("0"),
    playoffPoints: numeric("playoff_points").notNull().default("0"),
    awardPoints: numeric("award_points").notNull().default("0"),
    totalPoints: numeric("total_points").notNull().default("0"),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("team_event_scores_unique").on(t.teamKey, t.eventKey),
    index("team_event_scores_event_idx").on(t.eventKey),
  ],
);

/** Per-league aggregation of a manager's rostered teams' scores. Null eventKey = season aggregate. */
export const managerScores = pgTable(
  "manager_scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leagueId: uuid("league_id")
      .notNull()
      .references(() => leagues.id, { onDelete: "cascade" }),
    leagueMemberId: uuid("league_member_id")
      .notNull()
      .references(() => leagueMembers.id, { onDelete: "cascade" }),
    eventKey: text("event_key").references(() => events.key),
    totalPoints: numeric("total_points").notNull().default("0"),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("manager_scores_league_member_idx").on(t.leagueId, t.leagueMemberId),
    index("manager_scores_league_event_idx").on(t.leagueId, t.eventKey),
  ],
);

export const scoringRulesetsRelations = relations(scoringRulesets, ({ one }) => ({
  league: one(leagues, { fields: [scoringRulesets.leagueId], references: [leagues.id] }),
}));

export const managerScoresRelations = relations(managerScores, ({ one }) => ({
  league: one(leagues, { fields: [managerScores.leagueId], references: [leagues.id] }),
  member: one(leagueMembers, {
    fields: [managerScores.leagueMemberId],
    references: [leagueMembers.id],
  }),
}));
