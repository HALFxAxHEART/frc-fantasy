import { z } from "zod";
import { DEFAULT_ROSTER_SIZE } from "../constants";

export const createLeagueSchema = z
  .object({
    name: z.string().trim().min(3).max(80),
    spatialTopology: z.enum(["global", "district"]),
    districtKey: z.string().trim().min(1).optional(),
    temporalTopology: z.enum(["season_long", "single_event", "weekly_event_draft"]),
    tbaEventKey: z.string().trim().min(1).optional(),
    seasonYear: z.number().int().min(1992).max(2100),
    rosterSize: z.number().int().min(1).max(30).default(DEFAULT_ROSTER_SIZE),
  })
  .refine((v) => v.spatialTopology === "global" || !!v.districtKey, {
    message: "districtKey is required for district-specific leagues",
    path: ["districtKey"],
  })
  .refine((v) => v.temporalTopology === "season_long" || !!v.tbaEventKey, {
    message: "tbaEventKey is required for single-event and weekly-event-draft leagues",
    path: ["tbaEventKey"],
  });
export type CreateLeagueInput = z.infer<typeof createLeagueSchema>;

export const joinLeagueSchema = z.object({
  inviteCode: z.string().trim().toUpperCase().min(6).max(12),
  teamName: z.string().trim().min(2).max(60),
});
export type JoinLeagueInput = z.infer<typeof joinLeagueSchema>;
