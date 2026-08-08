import { z } from "zod";
import { DEFAULT_ROSTER_SIZE } from "../constants";

const leagueTopologyShape = z.object({
  spatialTopology: z.enum(["global", "district"]),
  districtKey: z.string().trim().min(1).optional(),
  temporalTopology: z.enum(["season_long", "single_event", "weekly_event_draft"]),
  tbaEventKey: z.string().trim().min(1).optional(),
  seasonYear: z.number().int().min(1992).max(2100),
  rosterSize: z.number().int().min(1).max(30).default(DEFAULT_ROSTER_SIZE),
});

function requireDistrictKeyForDistrictLeagues(v: z.infer<typeof leagueTopologyShape>) {
  return v.spatialTopology === "global" || !!v.districtKey;
}
function requireEventKeyForEventLeagues(v: z.infer<typeof leagueTopologyShape>) {
  return v.temporalTopology === "season_long" || !!v.tbaEventKey;
}

export const createLeagueSchema = leagueTopologyShape
  .extend({ name: z.string().trim().min(3).max(80) })
  .refine(requireDistrictKeyForDistrictLeagues, {
    message: "districtKey is required for district-specific leagues",
    path: ["districtKey"],
  })
  .refine(requireEventKeyForEventLeagues, {
    message: "tbaEventKey is required for single-event and weekly-event-draft leagues",
    path: ["tbaEventKey"],
  });
export type CreateLeagueInput = z.infer<typeof createLeagueSchema>;

export const joinLeagueSchema = z.object({
  inviteCode: z.string().trim().toUpperCase().min(6).max(12),
  teamName: z.string().trim().min(2).max(60),
});
export type JoinLeagueInput = z.infer<typeof joinLeagueSchema>;

export const updateLeagueSettingsSchema = z.object({
  name: z.string().trim().min(3).max(80).optional(),
  rosterSize: z.number().int().min(1).max(30).optional(),
  tradeWindowOpenDay: z.number().int().min(1).max(7).optional(),
  tradeWindowOpenTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  tradeWindowCloseDay: z.number().int().min(1).max(7).optional(),
  tradeWindowCloseTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  tradeWindowTimezone: z.string().trim().min(1).max(60).optional(),
});
export type UpdateLeagueSettingsInput = z.infer<typeof updateLeagueSettingsSchema>;

export const createPracticeDraftSchema = leagueTopologyShape
  .extend({
    commissionerTeamName: z.string().trim().min(2).max(60),
    botCount: z.number().int().min(1).max(7),
  })
  .refine(requireDistrictKeyForDistrictLeagues, {
    message: "districtKey is required for district-specific leagues",
    path: ["districtKey"],
  })
  .refine(requireEventKeyForEventLeagues, {
    message: "tbaEventKey is required for single-event and weekly-event-draft leagues",
    path: ["tbaEventKey"],
  })
  .refine((v) => !(v.spatialTopology === "global" && v.temporalTopology === "season_long"), {
    message: "Practice drafts need a specific event or district, not the unbounded global pool",
    path: ["spatialTopology"],
  });
export type CreatePracticeDraftInput = z.infer<typeof createPracticeDraftSchema>;
