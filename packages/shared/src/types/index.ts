export type SpatialTopology = "global" | "district";
export type TemporalTopology = "season_long" | "single_event" | "weekly_event_draft";
export type LeagueRole = "commissioner" | "manager";
export type LeagueStatus = "setup" | "drafting" | "active" | "completed";
export type RosterStatus = "valid" | "invalid_over_limit";

export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
}
