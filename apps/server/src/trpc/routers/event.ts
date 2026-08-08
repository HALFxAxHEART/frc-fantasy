import { z } from "zod";
import { eventSearchSchema } from "@frc-fantasy/shared";
import { getEventTeams, listDistricts, listUpcomingEvents, searchEvents } from "../../services/event";
import { publicProcedure, router } from "../trpc";

export const eventRouter = router({
  search: publicProcedure
    .input(eventSearchSchema)
    .query(({ input }) => searchEvents(input.query, input.year, input.districtKey)),

  listUpcoming: publicProcedure
    .input(z.object({ year: z.number().int().optional() }))
    .query(({ input }) => listUpcomingEvents(input.year)),

  listDistricts: publicProcedure
    .input(z.object({ year: z.number().int().optional() }))
    .query(({ input }) => listDistricts(input.year)),

  getEventTeams: publicProcedure
    .input(z.object({ eventKey: z.string().trim().min(1) }))
    .query(({ input }) => getEventTeams(input.eventKey)),
});
