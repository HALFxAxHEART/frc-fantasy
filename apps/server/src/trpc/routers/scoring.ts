import { z } from "zod";
import * as scoringService from "../../services/scoring";
import { protectedProcedure, router } from "../trpc";

export const scoringRouter = router({
  getLeagueStandings: protectedProcedure
    .input(z.object({ leagueId: z.string().uuid() }))
    .query(({ input }) => scoringService.getLeagueStandings(input.leagueId)),

  getManagerScore: protectedProcedure
    .input(z.object({ leagueMemberId: z.string().uuid() }))
    .query(({ input }) => scoringService.getManagerScore(input.leagueMemberId)),
});
