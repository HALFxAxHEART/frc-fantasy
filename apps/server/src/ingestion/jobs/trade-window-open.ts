import { db, schema } from "@frc-fantasy/db";
import { eq } from "drizzle-orm";
import { createLogger } from "../../lib/logger";

const logger = createLogger("jobs:trade-window-open");

/**
 * STUB — real trade window enforcement (flipping a per-league open/closed flag that
 * the trade router checks) ships with the trade market itself. This just proves the
 * cron wiring and ingestion_runs observability pattern works end to end.
 */
async function runTradeWindowOpen() {
  const [run] = await db
    .insert(schema.ingestionRuns)
    .values({ jobName: "trade-window-open", status: "running" })
    .returning();
  if (!run) throw new Error("failed to create ingestion_runs row");

  logger.info("trade-window-open stub ran (no-op)");

  await db
    .update(schema.ingestionRuns)
    .set({ status: "success", finishedAt: new Date(), summary: { note: "stub — not implemented yet" } })
    .where(eq(schema.ingestionRuns.id, run.id));
}

if (import.meta.main) {
  await runTradeWindowOpen();
  process.exit(0);
}

export { runTradeWindowOpen };
