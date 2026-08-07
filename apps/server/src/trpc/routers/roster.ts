import { z } from "zod";
import { getLeagueRosters, getMyRoster } from "../../services/roster";
import { protectedProcedure, router } from "../trpc";

export const rosterRouter = router({
  getMyRoster: protectedProcedure
    .input(z.object({ leagueId: z.string().uuid() }))
    .query(({ input, ctx }) => getMyRoster(input.leagueId, ctx.user.id)),

  getLeagueRosters: protectedProcedure
    .input(z.object({ leagueId: z.string().uuid() }))
    .query(({ input, ctx }) => getLeagueRosters(input.leagueId, ctx.user.id)),
});
