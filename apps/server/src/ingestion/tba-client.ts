import { env } from "../config/env";
import { cachedFetch } from "./api-cache";
import { TokenBucket } from "./rate-limiter";

const TBA_BASE = "https://www.thebluealliance.com/api/v3";

// TBA is generous (a few req/sec sustained is fine) but we stay well under it —
// this is a background job + on-demand lookups, not a scraper.
const bucket = new TokenBucket(10, 5);

export interface TbaTeam {
  key: string;
  team_number: number;
  nickname: string | null;
  name: string | null;
  city: string | null;
  state_prov: string | null;
  country: string | null;
  rookie_year: number | null;
  website: string | null;
  motto: string | null;
}

export interface TbaTeamMedia {
  type: string;
  foreign_key: string;
  details: Record<string, unknown> | null;
  preferred: boolean;
  direct_url?: string;
  view_url?: string;
}

export interface TbaDistrict {
  abbreviation: string;
  display_name: string;
  key: string;
  year: number;
}

export interface TbaEvent {
  key: string;
  name: string;
  short_name: string | null;
  event_type: number;
  district: { abbreviation: string; display_name: string; key: string; year: number } | null;
  city: string | null;
  state_prov: string | null;
  country: string | null;
  start_date: string;
  end_date: string;
  year: number;
  week: number | null;
  timezone: string | null;
  website: string | null;
  webcasts: { type: string; channel: string }[] | null;
}

export interface TbaMatch {
  key: string;
  event_key: string;
  comp_level: string;
  set_number: number;
  match_number: number;
  alliances: {
    red: { team_keys: string[]; score: number };
    blue: { team_keys: string[]; score: number };
  };
  winning_alliance: string;
  score_breakdown: Record<string, unknown> | null;
  actual_time: number | null;
}

export interface TbaRanking {
  rankings: {
    team_key: string;
    rank: number;
    sort_orders: number[] | null;
    record: { wins: number; losses: number; ties: number } | null;
    matches_played: number;
  }[];
}

export interface TbaOprs {
  oprs: Record<string, number>;
  dprs: Record<string, number>;
  ccwms: Record<string, number>;
}

export interface TbaAward {
  name: string;
  award_type: number;
  event_key: string;
  recipient_list: { team_key: string | null; awardee: string | null }[];
  year: number;
}

export interface TbaMatchSimple {
  key: string;
  event_key: string;
  comp_level: string;
  set_number: number;
  match_number: number;
  alliances: {
    red: { team_keys: string[]; score: number };
    blue: { team_keys: string[]; score: number };
  };
  winning_alliance: string;
}

export interface TbaDistrictPointsEntry {
  alliance_points: number;
  award_points: number;
  elim_points: number;
  qual_points: number;
  total: number;
}

export interface TbaDistrictPoints {
  points: Record<string, TbaDistrictPointsEntry>;
}

async function tbaGet<T>(path: string): Promise<T> {
  await bucket.take();
  return cachedFetch<T>({
    source: "tba",
    endpointKey: path,
    url: `${TBA_BASE}${path}`,
    headers: { "X-TBA-Auth-Key": env.TBA_API_KEY, Accept: "application/json" },
  });
}

export const tbaClient = {
  getTeamsPage: (year: number, page: number) => tbaGet<TbaTeam[]>(`/teams/${year}/${page}`),
  getTeam: (teamKey: string) => tbaGet<TbaTeam>(`/team/${teamKey}`),
  getTeamMedia: (teamKey: string, year: number) =>
    tbaGet<TbaTeamMedia[]>(`/team/${teamKey}/media/${year}`),
  getTeamAwards: (teamKey: string, year: number) =>
    tbaGet<TbaAward[]>(`/team/${teamKey}/awards/${year}`),
  /** Every award the team has ever won, in one call — much cheaper than per-year. */
  getTeamAwardsAll: (teamKey: string) => tbaGet<TbaAward[]>(`/team/${teamKey}/awards`),
  getTeamYearsParticipated: (teamKey: string) => tbaGet<number[]>(`/team/${teamKey}/years_participated`),
  getTeamMatchesSimpleForYear: (teamKey: string, year: number) =>
    tbaGet<TbaMatchSimple[]>(`/team/${teamKey}/matches/${year}/simple`),

  getDistricts: (year: number) => tbaGet<TbaDistrict[]>(`/districts/${year}`),
  getDistrictEvents: (districtKey: string) => tbaGet<TbaEvent[]>(`/district/${districtKey}/events`),
  getEventsByYear: (year: number) => tbaGet<TbaEvent[]>(`/events/${year}`),
  getEvent: (eventKey: string) => tbaGet<TbaEvent>(`/event/${eventKey}`),
  getEventTeamKeys: (eventKey: string) => tbaGet<string[]>(`/event/${eventKey}/teams/keys`),
  getEventMatches: (eventKey: string) => tbaGet<TbaMatch[]>(`/event/${eventKey}/matches`),
  getEventRankings: (eventKey: string) => tbaGet<TbaRanking>(`/event/${eventKey}/rankings`),
  getEventOprs: (eventKey: string) => tbaGet<TbaOprs>(`/event/${eventKey}/oprs`),
  getEventAwards: (eventKey: string) => tbaGet<TbaAward[]>(`/event/${eventKey}/awards`),
  getEventDistrictPoints: (eventKey: string) =>
    tbaGet<TbaDistrictPoints>(`/event/${eventKey}/district_points`),
  getTeamEventsForYear: (teamKey: string, year: number) =>
    tbaGet<string[]>(`/team/${teamKey}/events/${year}/keys`),
};
