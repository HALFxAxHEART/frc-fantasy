import { router } from "./trpc";
import { authRouter } from "./routers/auth";
import { leagueRouter } from "./routers/league";
import { rosterRouter } from "./routers/roster";
import { teamRouter } from "./routers/team";
import { eventRouter } from "./routers/event";
import { draftRouter } from "./routers/draft";
import { tradeRouter } from "./routers/trade";
import { scoringRouter } from "./routers/scoring";
import { practiceRouter } from "./routers/practice";
import { adminRouter } from "./routers/admin";

export const appRouter = router({
  auth: authRouter,
  league: leagueRouter,
  roster: rosterRouter,
  team: teamRouter,
  event: eventRouter,
  draft: draftRouter,
  trade: tradeRouter,
  scoring: scoringRouter,
  practice: practiceRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
