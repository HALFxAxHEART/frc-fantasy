import { z } from "zod";
import * as draftService from "../../services/draft";
import { broadcastDraftUpdate } from "../../ws/broadcast";
import { protectedProcedure, router } from "../trpc";

const leagueIdInput = z.object({ leagueId: z.string().uuid() });
const pickInput = z.object({ leagueId: z.string().uuid(), teamKey: z.string() });

export const draftRouter = router({
  getState: protectedProcedure
    .input(leagueIdInput)
    .query(({ input, ctx }) => draftService.getDraftState(input.leagueId, ctx.user.id, ctx.user.email)),

  getAvailablePool: protectedProcedure
    .input(leagueIdInput.extend({ query: z.string().optional() }))
    .query(({ input, ctx }) => draftService.getAvailablePool(input.leagueId, ctx.user.id, ctx.user.email, input.query)),

  create: protectedProcedure.input(leagueIdInput).mutation(async ({ input, ctx }) => {
    const draft = await draftService.createDraft(input.leagueId, ctx.user.id, ctx.user.email);
    broadcastDraftUpdate(input.leagueId);
    return draft;
  }),

  makePick: protectedProcedure.input(pickInput).mutation(async ({ input, ctx }) => {
    const pick = await draftService.makePick(input.leagueId, input.teamKey, ctx.user.id);
    broadcastDraftUpdate(input.leagueId);
    return pick;
  }),

  forceAssign: protectedProcedure.input(pickInput).mutation(async ({ input, ctx }) => {
    const pick = await draftService.forceAssignPick(input.leagueId, input.teamKey, ctx.user.id, ctx.user.email);
    broadcastDraftUpdate(input.leagueId);
    return pick;
  }),

  pause: protectedProcedure.input(leagueIdInput).mutation(async ({ input, ctx }) => {
    const draft = await draftService.pauseDraft(input.leagueId, ctx.user.id, ctx.user.email);
    broadcastDraftUpdate(input.leagueId);
    return draft;
  }),

  resume: protectedProcedure.input(leagueIdInput).mutation(async ({ input, ctx }) => {
    const draft = await draftService.resumeDraft(input.leagueId, ctx.user.id, ctx.user.email);
    broadcastDraftUpdate(input.leagueId);
    return draft;
  }),

  getRecommendations: protectedProcedure
    .input(leagueIdInput.extend({ limit: z.number().int().min(1).max(50).default(10) }))
    .query(({ input, ctx }) => draftService.getRecommendations(input.leagueId, ctx.user.id, ctx.user.email, input.limit)),

  restart: protectedProcedure.input(leagueIdInput).mutation(async ({ input, ctx }) => {
    await draftService.restartDraft(input.leagueId, ctx.user.id, ctx.user.email);
    broadcastDraftUpdate(input.leagueId);
  }),
});
