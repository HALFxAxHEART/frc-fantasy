import { relations, sql } from "drizzle-orm";
import { boolean, check, pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { draftPicks } from "./draft";
import { leagueMembers, leagues } from "./leagues";
import { teams } from "./tba-cache";

export const tradeStatusEnum = pgEnum("trade_status", [
  "proposed",
  "accepted",
  "rejected",
  "vetoed",
  "executed",
  "reverted",
]);

export const tradeAssetTypeEnum = pgEnum("trade_asset_type", ["team", "draft_pick"]);

export const trades = pgTable("trades", {
  id: uuid("id").primaryKey().defaultRandom(),
  leagueId: uuid("league_id")
    .notNull()
    .references(() => leagues.id, { onDelete: "cascade" }),
  status: tradeStatusEnum("status").notNull().default("proposed"),
  proposedByMemberId: uuid("proposed_by_member_id")
    .notNull()
    .references(() => leagueMembers.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  executedAt: timestamp("executed_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});

/** Supports multi-team (>2 party) atomic trades, not just 1:1. */
export const tradeParties = pgTable(
  "trade_parties",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tradeId: uuid("trade_id")
      .notNull()
      .references(() => trades.id, { onDelete: "cascade" }),
    leagueMemberId: uuid("league_member_id")
      .notNull()
      .references(() => leagueMembers.id),
    /** null = pending, true = accepted, false = rejected — tri-state. */
    accepted: boolean("accepted"),
  },
  (t) => [unique("trade_parties_trade_member_unique").on(t.tradeId, t.leagueMemberId)],
);

export const tradeAssets = pgTable(
  "trade_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tradeId: uuid("trade_id")
      .notNull()
      .references(() => trades.id, { onDelete: "cascade" }),
    fromMemberId: uuid("from_member_id")
      .notNull()
      .references(() => leagueMembers.id),
    toMemberId: uuid("to_member_id")
      .notNull()
      .references(() => leagueMembers.id),
    assetType: tradeAssetTypeEnum("asset_type").notNull(),
    teamKey: text("team_key").references(() => teams.key),
    draftPickId: uuid("draft_pick_id").references(() => draftPicks.id),
  },
  (t) => [
    check(
      "exactly_one_asset_reference",
      sql`(${t.assetType} = 'team' AND ${t.teamKey} IS NOT NULL AND ${t.draftPickId} IS NULL) OR
          (${t.assetType} = 'draft_pick' AND ${t.draftPickId} IS NOT NULL AND ${t.teamKey} IS NULL)`,
    ),
  ],
);

export const tradesRelations = relations(trades, ({ one, many }) => ({
  league: one(leagues, { fields: [trades.leagueId], references: [leagues.id] }),
  proposedBy: one(leagueMembers, {
    fields: [trades.proposedByMemberId],
    references: [leagueMembers.id],
  }),
  parties: many(tradeParties),
  assets: many(tradeAssets),
}));

export const tradePartiesRelations = relations(tradeParties, ({ one }) => ({
  trade: one(trades, { fields: [tradeParties.tradeId], references: [trades.id] }),
  member: one(leagueMembers, {
    fields: [tradeParties.leagueMemberId],
    references: [leagueMembers.id],
  }),
}));

export const tradeAssetsRelations = relations(tradeAssets, ({ one }) => ({
  trade: one(trades, { fields: [tradeAssets.tradeId], references: [trades.id] }),
  fromMember: one(leagueMembers, {
    fields: [tradeAssets.fromMemberId],
    references: [leagueMembers.id],
  }),
  toMember: one(leagueMembers, {
    fields: [tradeAssets.toMemberId],
    references: [leagueMembers.id],
  }),
  team: one(teams, { fields: [tradeAssets.teamKey], references: [teams.key] }),
  draftPick: one(draftPicks, {
    fields: [tradeAssets.draftPickId],
    references: [draftPicks.id],
  }),
}));
