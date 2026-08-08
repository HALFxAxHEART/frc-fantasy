import { schema, type Database, type Tx } from "@frc-fantasy/db";
import { desc, inArray } from "drizzle-orm";
import { alreadyDraftedKeys, type DraftPool, type PoolTeam } from "./pool";

async function latestEpaByTeam(executor: Database | Tx, teamKeys: string[]): Promise<Map<string, number>> {
  if (teamKeys.length === 0) return new Map();

  const rows = await executor
    .select({ teamKey: schema.epaSnapshots.teamKey, epaMean: schema.epaSnapshots.epaMean })
    .from(schema.epaSnapshots)
    .where(inArray(schema.epaSnapshots.teamKey, teamKeys))
    .orderBy(desc(schema.epaSnapshots.year));

  // Rows come back newest-year-first per team (globally sorted) — first occurrence
  // of a teamKey is therefore always its most recent snapshot.
  const latest = new Map<string, number>();
  for (const row of rows) {
    if (!latest.has(row.teamKey)) latest.set(row.teamKey, Number(row.epaMean));
  }
  return latest;
}

/**
 * Ranks a bounded pool's still-available teams by their most recent Statbotics EPA,
 * highest first. Teams with no cached EPA yet sort last rather than being excluded —
 * still pickable/recommendable, just deprioritized versus teams we have real data for.
 * Practice drafts are restricted to bounded pools specifically so this ranking is
 * cheap and complete (an unbounded global pool would mean ranking thousands of teams).
 */
export async function rankAvailableTeamsByEpa(
  executor: Database | Tx,
  draftId: string,
  pool: DraftPool,
): Promise<PoolTeam[]> {
  if (!pool.bounded) return [];

  const drafted = await alreadyDraftedKeys(executor, draftId);
  const available = pool.teams.filter((t) => !drafted.includes(t.key));
  const epaByTeam = await latestEpaByTeam(executor, available.map((t) => t.key));

  return [...available].sort((a, b) => {
    const ea = epaByTeam.get(a.key) ?? Number.NEGATIVE_INFINITY;
    const eb = epaByTeam.get(b.key) ?? Number.NEGATIVE_INFINITY;
    return eb - ea;
  });
}

export async function pickBestAvailableTeamByEpa(tx: Tx, draftId: string, pool: DraftPool): Promise<string | null> {
  const ranked = await rankAvailableTeamsByEpa(tx, draftId, pool);
  return ranked[0]?.key ?? null;
}
