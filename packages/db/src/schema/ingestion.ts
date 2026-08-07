import { jsonb, pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

export const apiSourceEnum = pgEnum("api_source", ["tba", "statbotics"]);
export const ingestionRunStatusEnum = pgEnum("ingestion_run_status", [
  "running",
  "success",
  "failed",
]);

/** The literal ETag/If-None-Match cache the TBA and Statbotics clients read/write. */
export const apiCacheEntries = pgTable(
  "api_cache_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    source: apiSourceEnum("source").notNull(),
    endpointKey: text("endpoint_key").notNull(), // normalized path+query, e.g. "/team/frc5090/media/2026"
    etag: text("etag"),
    responseBody: jsonb("response_body"),
    statusCode: text("status_code").notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("api_cache_entries_source_endpoint_unique").on(t.source, t.endpointKey)],
);

export const ingestionRuns = pgTable("ingestion_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobName: text("job_name").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  status: ingestionRunStatusEnum("status").notNull().default("running"),
  summary: jsonb("summary"),
  errorMessage: text("error_message"),
});
