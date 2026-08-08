import { db, schema } from "@frc-fantasy/db";
import { and, eq } from "drizzle-orm";
import { createLogger } from "../lib/logger";

const logger = createLogger("api-cache");

export type ApiSource = "tba" | "statbotics";

interface CachedFetchOptions {
  source: ApiSource;
  /** Normalized path+query, unique per source, e.g. "/team/frc5090/media/2026". */
  endpointKey: string;
  url: string;
  headers?: Record<string, string>;
}

/**
 * Get-or-fetch-through-cache: sends If-None-Match from the last stored etag when we
 * have one. A 304 means "unchanged" — we return the cached body without touching it.
 * A 200 means the etag (if the upstream sends one) and body get written back.
 */
export async function cachedFetch<T>(options: CachedFetchOptions): Promise<T> {
  const { source, endpointKey, url, headers = {} } = options;

  const [existing] = await db
    .select()
    .from(schema.apiCacheEntries)
    .where(
      and(
        eq(schema.apiCacheEntries.source, source),
        eq(schema.apiCacheEntries.endpointKey, endpointKey),
      ),
    )
    .limit(1);

  const requestHeaders = { ...headers };
  if (existing?.etag) {
    requestHeaders["If-None-Match"] = existing.etag;
  }

  let response: Response;
  try {
    response = await fetch(url, { headers: requestHeaders, signal: AbortSignal.timeout(10_000) });
  } catch (err) {
    throw new Error(`${source} request timed out or failed to connect (${url}): ${String(err)}`);
  }

  if (response.status === 304 && existing) {
    logger.debug("cache hit (304)", { source, endpointKey });
    return existing.responseBody as T;
  }

  if (!response.ok) {
    throw new Error(`${source} request failed: ${response.status} ${response.statusText} (${url})`);
  }

  const body = (await response.json()) as T;
  const etag = response.headers.get("etag");

  await db
    .insert(schema.apiCacheEntries)
    .values({
      source,
      endpointKey,
      etag,
      responseBody: body,
      statusCode: String(response.status),
    })
    .onConflictDoUpdate({
      target: [schema.apiCacheEntries.source, schema.apiCacheEntries.endpointKey],
      set: {
        etag,
        responseBody: body,
        statusCode: String(response.status),
        fetchedAt: new Date(),
      },
    });

  logger.debug("cache miss, fetched fresh", { source, endpointKey, status: response.status });
  return body;
}
