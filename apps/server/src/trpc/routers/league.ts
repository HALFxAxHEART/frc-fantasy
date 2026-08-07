import { z } from "zod";
import { createLeagueSchema, joinLeagueSchema } from "@frc-fantasy/shared";
import {
  createLeague,
  getLeagueById,
  joinLeagueByInviteCode,
  listMembers,
  listMyLeagues,
} from "../../services/league";
import { protectedProcedure, router } from "../trpc";

export const leagueRouter = router({
  create: protectedProcedure
    .input(createLeagueSchema.and(z.object({ commissionerTeamName: z.string().trim().min(2).max(60) })))
    .mutation(({ input, ctx }) =>
      createLeague(input, ctx.user.id, input.commissionerTeamName),
    ),

  joinByInviteCode: protectedProcedure
    .input(joinLeagueSchema)
    .mutation(({ input, ctx }) => joinLeagueByInviteCode(input.inviteCode, ctx.user.id, input.teamName)),

  getById: protectedProcedure
    .input(z.object({ leagueId: z.string().uuid() }))
    .query(({ input, ctx }) => getLeagueById(input.leagueId, ctx.user.id)),

  listMine: protectedProcedure.query(({ ctx }) => listMyLeagues(ctx.user.id)),

  listMembers: protectedProcedure
    .input(z.object({ leagueId: z.string().uuid() }))
    .query(({ input, ctx }) => listMembers(input.leagueId, ctx.user.id)),
});
