import { env } from "./config/env";
import { createLogger } from "./lib/logger";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./trpc/router";
import { createContext } from "./trpc/context";
import { getTeamAvatar } from "./services/team";
import { draftRoomWebSocketHandlers, tryUpgradeDraftRoom } from "./ws/draft-room";
import { runDailyIngest } from "./ingestion/jobs/daily-ingest";

const logger = createLogger("server");

const WEB_DIST = new URL("../../web/dist", import.meta.url).pathname;

async function serveStatic(pathname: string): Promise<Response> {
  const filePath = pathname === "/" ? "/index.html" : pathname;
  const file = Bun.file(`${WEB_DIST}${filePath}`);
  if (await file.exists()) return new Response(file);

  // SPA fallback: unknown non-asset paths resolve to index.html so client-side
  // routing (TanStack Router) can take over.
  const indexFile = Bun.file(`${WEB_DIST}/index.html`);
  if (await indexFile.exists()) return new Response(indexFile);

  return new Response("Not found", { status: 404 });
}

const server = Bun.serve({
  port: env.PORT,
  async fetch(req, srv) {
    const url = new URL(req.url);

    if (tryUpgradeDraftRoom(req, srv)) return undefined;

    if (url.pathname === "/health") {
      return new Response("ok", { status: 200 });
    }

    const avatarMatch = url.pathname.match(/^\/api\/teams\/([^/]+)\/avatar$/);
    if (avatarMatch) {
      const teamKey = avatarMatch[1] as string;
      const avatar = await getTeamAvatar(teamKey);
      if (!avatar) return new Response("Not found", { status: 404 });
      return new Response(Buffer.from(avatar.blob, "base64"), {
        headers: {
          "Content-Type": avatar.contentType,
          "Cache-Control": "public, max-age=86400",
        },
      });
    }

    if (url.pathname.startsWith("/api/trpc")) {
      return fetchRequestHandler({
        endpoint: "/api/trpc",
        req,
        router: appRouter,
        createContext,
      });
    }

    return serveStatic(url.pathname);
  },
  websocket: draftRoomWebSocketHandlers,
});

logger.info("server listening", { port: server.port, env: env.NODE_ENV });

if (env.JOBS_MODE === "in-process") {
  logger.info("JOBS_MODE=in-process — dev-only fallback timer active (Coolify Scheduled Tasks unavailable locally)");
  const ONE_HOUR_MS = 60 * 60 * 1000;
  setInterval(() => {
    runDailyIngest().catch((err) => logger.error("in-process daily-ingest run failed", { error: String(err) }));
  }, ONE_HOUR_MS);
}
