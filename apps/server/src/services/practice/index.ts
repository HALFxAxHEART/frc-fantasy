import { db, schema } from "@frc-fantasy/db";
import { eq } from "drizzle-orm";
import type { CreatePracticeDraftInput } from "@frc-fantasy/shared";
import { createLogger } from "../../lib/logger";
import { createDraft } from "../draft";
import type { Draft } from "../draft/core";
import { resolveDraftPool } from "../draft/pool";
import { createLeague } from "../league";
import { ensureEpaHistoryCached } from "../team";

const logger = createLogger("service:practice");

const BOT_NAMES = ["Bot Alpha", "Bot Bravo", "Bot Charlie", "Bot Delta", "Bot Echo", "Bot Foxtrot", "Bot Golf"];

/**
 * One-shot setup for a solo practice draft: creates a league scoped to a bounded pool
 * (a specific event or a district's season pool — never the unbounded global pool, since
 * ranking bots/recommendations by EPA needs a pool small enough to fully rank), adds the
 * human plus N EPA-bot managers, and starts the draft immediately.
 *
 * EPA pre-warming for the whole pool happens in the background, not awaited — a pool
 * can be 100+ teams, each needing its own Statbotics round-trip on a cold cache, and
 * blocking the response on that would recreate the exact "stuck loading forever" feel
 * this session's earlier fetch-timeout fix was meant to kill. Bots/recommendations
 * degrade gracefully in the meantime (missing EPA sorts last, never crashes) and fill
 * in live as picks happen — early picks in a cold pool just won't be EPA-informed yet.
 */
export async function createPracticeDraft(
  input: CreatePracticeDraftInput,
  userId: string,
): Promise<{ leagueId: string; draft: Draft }> {
  const name = `Practice Draft — ${input.tbaEventKey ?? input.districtKey ?? input.seasonYear}`;
  const league = await createLeague({ ...input, name }, userId, input.commissionerTeamName);

  try {
    await db.update(schema.leagues).set({ isPractice: true }).where(eq(schema.leagues.id, league.id));

    await db.transaction(async (tx) => {
      for (let i = 0; i < input.botCount; i++) {
        const [member] = await tx
          .insert(schema.leagueMembers)
          .values({ leagueId: league.id, userId: null, role: "manager", teamName: BOT_NAMES[i]!, isBot: true })
          .returning();
        if (!member) throw new Error("failed to create bot member");
        await tx.insert(schema.rosters).values({ leagueMemberId: member.id });
      }
    });

    const draft = await createDraft(league.id, userId);

    warmPoolEpaInBackground(league);

    return { leagueId: league.id, draft };
  } catch (err) {
    // Bot members/rosters/scoring ruleset all cascade-delete off the league FK —
    // a half-set-up practice draft should never be left behind for the user to
    // clean up or accidentally resubmit into a duplicate.
    await db.delete(schema.leagues).where(eq(schema.leagues.id, league.id));
    throw err;
  }
}

function warmPoolEpaInBackground(league: Awaited<ReturnType<typeof createLeague>>) {
  resolveDraftPool(league)
    .then(async (pool) => {
      if (!pool.bounded) return;
      const results = await Promise.allSettled(pool.teams.map((t) => ensureEpaHistoryCached(t.teamNumber, t.key)));
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed > 0) {
        logger.warn("some pool teams failed to pre-warm EPA", { leagueId: league.id, failed, total: pool.teams.length });
      }
    })
    .catch((err) => logger.warn("EPA pre-warm failed for practice draft pool", { leagueId: league.id, error: String(err) }));
}
