import { z } from "zod";
import * as tradeService from "../../services/trade";
import { protectedProcedure, router } from "../trpc";

export const tradeRouter = router({
  propose: protectedProcedure
    .input(z.object({ leagueId: z.string().uuid() }))
    .mutation(({ input }) => tradeService.proposeTrade(input.leagueId)),

  respond: protectedProcedure
    .input(z.object({ tradeId: z.string().uuid(), accept: z.boolean() }))
    .mutation(({ input }) => tradeService.respondToTrade(input.tradeId, input.accept)),

  listTradeBlock: protectedProcedure
    .input(z.object({ leagueId: z.string().uuid() }))
    .query(({ input }) => tradeService.listTradeBlock(input.leagueId)),
});
