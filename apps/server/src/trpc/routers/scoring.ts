import { z } from "zod";
import * as scoringService from "../../services/scoring";
import { protectedProcedure, router } from "../trpc";

export const scoringRouter = router({
  getLeagueStandings: protectedProcedure
    .input(z.object({ leagueId: z.string().uuid() }))
    .query(({ input, ctx }) => scoringService.getLeagueStandings(input.leagueId, ctx.user.id)),

  getManagerScore: protectedProcedure
    .input(z.object({ leagueMemberId: z.string().uuid() }))
    .query(({ input, ctx }) => scoringService.getManagerScore(input.leagueMemberId, ctx.user.id)),
});
