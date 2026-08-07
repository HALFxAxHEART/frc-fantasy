import { db, schema } from "@frc-fantasy/db";
import { eq } from "drizzle-orm";
import { createLogger } from "../../lib/logger";

const logger = createLogger("jobs:trade-window-close");

/** STUB — see trade-window-open.ts for why this is a no-op this session. */
async function runTradeWindowClose() {
  const [run] = await db
    .insert(schema.ingestionRuns)
    .values({ jobName: "trade-window-close", status: "running" })
    .returning();
  if (!run) throw new Error("failed to create ingestion_runs row");

  logger.info("trade-window-close stub ran (no-op)");

  await db
    .update(schema.ingestionRuns)
    .set({ status: "success", finishedAt: new Date(), summary: { note: "stub — not implemented yet" } })
    .where(eq(schema.ingestionRuns.id, run.id));
}

if (import.meta.main) {
  await runTradeWindowClose();
  process.exit(0);
}

export { runTradeWindowClose };
