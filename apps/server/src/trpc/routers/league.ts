import { z } from "zod";
import { createLeagueSchema, joinLeagueSchema, updateLeagueSettingsSchema } from "@frc-fantasy/shared";
import {
  createLeague,
  deleteLeague,
  getLeagueById,
  joinLeagueByInviteCode,
  kickMember,
  listMembers,
  listMyLeagues,
  updateLeagueSettings,
} from "../../services/league";
import { protectedProcedure, router } from "../trpc";

const leagueIdInput = z.object({ leagueId: z.string().uuid() });

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
    .input(leagueIdInput)
    .query(({ input, ctx }) => getLeagueById(input.leagueId, ctx.user.id, ctx.user.email)),

  listMine: protectedProcedure.query(({ ctx }) => listMyLeagues(ctx.user.id)),

  listMembers: protectedProcedure
    .input(leagueIdInput)
    .query(({ input, ctx }) => listMembers(input.leagueId, ctx.user.id, ctx.user.email)),

  delete: protectedProcedure
    .input(leagueIdInput)
    .mutation(({ input, ctx }) => deleteLeague(input.leagueId, ctx.user.id, ctx.user.email)),

  kickMember: protectedProcedure
    .input(leagueIdInput.extend({ memberId: z.string().uuid() }))
    .mutation(({ input, ctx }) => kickMember(input.leagueId, input.memberId, ctx.user.id, ctx.user.email)),

  updateSettings: protectedProcedure
    .input(leagueIdInput.extend({ settings: updateLeagueSettingsSchema }))
    .mutation(({ input, ctx }) => updateLeagueSettings(input.leagueId, ctx.user.id, input.settings, ctx.user.email)),
});
