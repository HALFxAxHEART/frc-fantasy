import { db, schema } from "@frc-fantasy/db";
import { and, eq, lt } from "drizzle-orm";
import { createLogger } from "../../lib/logger";
import { broadcastDraftUpdate } from "../../ws/broadcast";
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
