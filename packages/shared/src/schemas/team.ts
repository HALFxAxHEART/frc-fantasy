import { z } from "zod";

export const teamSearchSchema = z.object({
  query: z.string().trim().min(1).max(60),
});
export type TeamSearchInput = z.infer<typeof teamSearchSchema>;

export const teamProfileSchema = z.object({
  teamNumber: z.number().int().positive(),
});
export type TeamProfileInput = z.infer<typeof teamProfileSchema>;

export const eventSearchSchema = z.object({
  query: z.string().trim().min(1).max(80).optional(),
  year: z.number().int().min(1992).max(2100).optional(),
  districtKey: z.string().trim().optional(),
});
export type EventSearchInput = z.infer<typeof eventSearchSchema>;
