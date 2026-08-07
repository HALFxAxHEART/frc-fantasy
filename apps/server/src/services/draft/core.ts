import { schema, type Database, type Tx } from "@frc-fantasy/db";
import { and, eq, sql } from "drizzle-orm";
import { NotFoundError, ValidationError } from "../../lib/errors";
import { isTeamInPool, type DraftPool } from "./pool";

export type Draft = typeof schema.drafts.$inferSelect;
export type DraftPick = typeof schema.draftPicks.$inferSelect;
export type League = typeof schema.leagues.$inferSelect;

/** The `FOR UPDATE` read every draft-mutating operation starts with — serializes all
 * mutation types (pick, pause, resume, undo, force-assign, autopick) against one
 * draft to one-at-a-time, so races only ever need to be reasoned about pairwise
 * inside a single lock, not across five independent code paths. */
export async function lockDraft(tx: Tx, leagueId: string): Promise<Draft> {
  const [draft] = await tx.select().from(schema.drafts).where(eq(schema.drafts.leagueId, leagueId)).for("update");
  if (!draft) throw new NotFoundError("Draft");
  return draft;
}

export async function getLeagueRow(executor: Database | Tx, leagueId: string): Promise<League> {
  const [league] = await executor.select().from(schema.leagues).where(eq(schema.leagues.id, leagueId)).limit(1);
  if (!league) throw new NotFoundError("League");
  return league;
}

export async function getPickByNumber(executor: Database | Tx, draftId: string, pickNumber: number): Promise<DraftPick> {
  const [pick] = await executor
    .select()
    .from(schema.draftPicks)
    .where(and(eq(schema.draftPicks.draftId, draftId), eq(schema.draftPicks.pickNumber, pickNumber)))
    .limit(1);
  if (!pick) throw new NotFoundError("Draft pick");
  return pick;
}

function pickDeadline(secondsPerPick: number): Date {
  return new Date(Date.now() + secondsPerPick * 1000);
}

/**
 * The one place the "claim a pick" race guard lives — makePick, forceAssignPick, and
 * the autopick sweep all funnel through this. Must be called with `draft` already
 * locked via lockDraft() in the same transaction.
 */
export async function claimPick(
  tx: Tx,
  draft: Draft,
  league: League,
  pool: DraftPool,
  targetPick: DraftPick,
  teamKey: string,
  isAutopick: boolean,
): Promise<DraftPick> {
  if (!(await isTeamInPool(pool, teamKey))) {
    throw new ValidationError("That team isn't in this league's draft pool.");
  }

  const [claimed] = await tx
    .update(schema.draftPicks)
    .set({ teamKey, madeAt: new Date(), isAutopick })
    .where(and(eq(schema.draftPicks.id, targetPick.id), sql`${schema.draftPicks.teamKey} IS NULL`))
    .returning();
  if (!claimed) throw new ValidationError("This pick was already made.");

  const [roster] = await tx
    .select({ id: schema.rosters.id })
    .from(schema.rosters)
    .where(eq(schema.rosters.leagueMemberId, claimed.leagueMemberId))
    .limit(1);
  if (!roster) throw new Error(`roster missing for league member ${claimed.leagueMemberId}`);
  await tx.insert(schema.rosterSlots).values({ rosterId: roster.id, teamKey, acquiredVia: "draft" });

  const totalPicks = draft.pickOrder.length * league.rosterSize;
  const nextPickNumber = draft.currentPickNumber + 1;

  if (nextPickNumber > totalPicks) {
    await tx
      .update(schema.drafts)
      .set({ status: "completed", completedAt: new Date(), currentPickDeadline: null })
      .where(and(eq(schema.drafts.id, draft.id), eq(schema.drafts.currentPickNumber, draft.currentPickNumber)));
    await tx.update(schema.leagues).set({ status: "active" }).where(eq(schema.leagues.id, league.id));
  } else {
    await tx
      .update(schema.drafts)
      .set({ currentPickNumber: nextPickNumber, currentPickDeadline: pickDeadline(draft.secondsPerPick) })
      .where(and(eq(schema.drafts.id, draft.id), eq(schema.drafts.currentPickNumber, draft.currentPickNumber)));
  }

  return claimed;
}

export { pickDeadline };
