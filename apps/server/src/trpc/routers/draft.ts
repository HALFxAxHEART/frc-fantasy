import { z } from "zod";
import * as draftService from "../../services/draft";
import { protectedProcedure, router } from "../trpc";

export const draftRouter = router({
  getState: protectedProcedure
    .input(z.object({ leagueId: z.string().uuid() }))
    .query(({ input }) => draftService.getDraftState(input.leagueId)),

  create: protectedProcedure
    .input(z.object({ leagueId: z.string().uuid() }))
    .mutation(({ input }) => draftService.createDraft(input.leagueId)),

  makePick: protectedProcedure
    .input(z.object({ draftId: z.string().uuid(), teamKey: z.string() }))
    .mutation(({ input }) => draftService.makePick(input.draftId, input.teamKey)),

  pause: protectedProcedure
    .input(z.object({ draftId: z.string().uuid() }))
    .mutation(({ input }) => draftService.pauseDraft(input.draftId)),

  undo: protectedProcedure
    .input(z.object({ draftId: z.string().uuid() }))
    .mutation(({ input }) => draftService.undoLastPick(input.draftId)),
});
