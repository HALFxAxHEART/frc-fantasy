import { z } from "zod";
import { getRecentSyncRuns, listAllLeagues, triggerSync } from "../../services/admin";
import { deleteLeague } from "../../services/league";
import { adminProcedure, router } from "../trpc";

export const adminRouter = router({
  listLeagues: adminProcedure.query(() => listAllLeagues()),

  deleteLeague: adminProcedure
    .input(z.object({ leagueId: z.string().uuid() }))
    .mutation(({ input, ctx }) => deleteLeague(input.leagueId, ctx.user.id, ctx.user.email)),

  triggerSync: adminProcedure.mutation(() => {
    triggerSync();
    return { started: true };
  }),

  getRecentSyncRuns: adminProcedure.query(() => getRecentSyncRuns()),
});
