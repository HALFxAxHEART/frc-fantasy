import { teamProfileSchema, teamSearchSchema } from "@frc-fantasy/shared";
import { getTeamAwards, getTeamProfile, getTeamYearStats, searchTeams } from "../../services/team";
import { publicProcedure, router } from "../trpc";

export const teamRouter = router({
  search: publicProcedure.input(teamSearchSchema).query(({ input }) => searchTeams(input.query)),

  getProfile: publicProcedure.input(teamProfileSchema).query(({ input }) => getTeamProfile(input.teamNumber)),

  getYearStats: publicProcedure
    .input(teamProfileSchema)
    .query(({ input }) => getTeamYearStats(input.teamNumber)),

  getAwards: publicProcedure.input(teamProfileSchema).query(({ input }) => getTeamAwards(input.teamNumber)),
});
