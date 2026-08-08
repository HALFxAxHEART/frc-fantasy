import { db, schema } from "@frc-fantasy/db";
import { and, eq, lt } from "drizzle-orm";
import { createLogger } from "../../lib/logger";
import { broadcastDraftUpdate } from "../../ws/broadcast";
import { pickBestAvailableTeamByEpa } from "./bot";
import { claimPick, getLeagueRow, getPickByNumber, lockDraft } from "./core";
import { pickRandomAvailableTeam, resolveDraftPool } from "./pool";

const logger = createLogger("draft:autopick");

async function autopickOneDraft(leagueId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const draft = await lockDraft(tx, leagueId);

    // Re-validate inside the lock — the outer scan that found this candidate is
    // stale by definition once another transaction (a manager's pick, a pause,
    // an earlier sweep tick) may have already run.
    if (draft.status !== "in_progress" || !draft.currentPickDeadline || draft.currentPickDeadline > new Date()) {
      return;
    }

    const league = await getLeagueRow(tx, leagueId);
    const targetPick = await getPickByNumber(tx, draft.id, draft.currentPickNumber);
    const pool = await resolveDraftPool(league);

    const teamKey = await pickRandomAvailableTeam(tx, draft.id, pool);
    if (!teamKey) {
      // Shouldn't happen — createDraft validates pool size >= total picks needed.
      logger.error("autopick found no available team in a well-formed draft", { leagueId, draftId: draft.id });
      return;
    }

    await claimPick(tx, draft, league, pool, targetPick, teamKey, true);
  });

  broadcastDraftUpdate(leagueId);
}

export async function sweepExpiredDraftPicks(): Promise<void> {
  const due = await db
    .select({ leagueId: schema.drafts.leagueId })
    .from(schema.drafts)
    .where(and(eq(schema.drafts.status, "in_progress"), lt(schema.drafts.currentPickDeadline, new Date())));

  if (due.length === 0) return;

  const results = await Promise.allSettled(due.map((d) => autopickOneDraft(d.leagueId)));
  for (const [i, result] of results.entries()) {
    if (result.status === "rejected") {
      logger.error("autopick failed for league", { leagueId: due[i]!.leagueId, error: String(result.reason) });
    }
  }
}

async function botPickOneDraft(leagueId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const draft = await lockDraft(tx, leagueId);
    if (draft.status !== "in_progress") return;

    const targetPick = await getPickByNumber(tx, draft.id, draft.currentPickNumber);
    if (targetPick.teamKey) return; // already claimed — lost the race to a human/another sweep tick

    const [member] = await tx
      .select({ isBot: schema.leagueMembers.isBot })
      .from(schema.leagueMembers)
      .where(eq(schema.leagueMembers.id, targetPick.leagueMemberId))
      .limit(1);
    if (!member?.isBot) return; // re-validate inside the lock — the outer scan is stale by definition

    const league = await getLeagueRow(tx, leagueId);
    const pool = await resolveDraftPool(league);
    const teamKey = await pickBestAvailableTeamByEpa(tx, draft.id, pool);
    if (!teamKey) {
      logger.error("bot pick found no available team in a well-formed draft", { leagueId, draftId: draft.id });
      return;
    }

    await claimPick(tx, draft, league, pool, targetPick, teamKey, false);
  });

  broadcastDraftUpdate(leagueId);
}

/**
 * Runs alongside sweepExpiredDraftPicks on the same interval — bots don't wait out
 * the human pick timer, they pick on the next sweep tick after it becomes their turn
 * (a few seconds of natural "thinking" pause instead of an instant, jarring pick).
 */
export async function sweepBotPicks(): Promise<void> {
  const inProgressDrafts = await db
    .select({
      leagueId: schema.drafts.leagueId,
      draftId: schema.drafts.id,
      currentPickNumber: schema.drafts.currentPickNumber,
    })
    .from(schema.drafts)
    .where(eq(schema.drafts.status, "in_progress"));

  if (inProgressDrafts.length === 0) return;

  const candidates: string[] = [];
  for (const d of inProgressDrafts) {
    const [pick] = await db
      .select({ leagueMemberId: schema.draftPicks.leagueMemberId, teamKey: schema.draftPicks.teamKey })
      .from(schema.draftPicks)
      .where(and(eq(schema.draftPicks.draftId, d.draftId), eq(schema.draftPicks.pickNumber, d.currentPickNumber)))
      .limit(1);
    if (!pick || pick.teamKey) continue;

    const [member] = await db
      .select({ isBot: schema.leagueMembers.isBot })
      .from(schema.leagueMembers)
      .where(eq(schema.leagueMembers.id, pick.leagueMemberId))
      .limit(1);
    if (member?.isBot) candidates.push(d.leagueId);
  }

  if (candidates.length === 0) return;

  const results = await Promise.allSettled(candidates.map((leagueId) => botPickOneDraft(leagueId)));
  for (const [i, result] of results.entries()) {
    if (result.status === "rejected") {
      logger.error("bot pick failed for league", { leagueId: candidates[i]!, error: String(result.reason) });
    }
  }
}
