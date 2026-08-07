CREATE TYPE "public"."league_role" AS ENUM('commissioner', 'manager');--> statement-breakpoint
CREATE TYPE "public"."league_status" AS ENUM('setup', 'drafting', 'active', 'completed');--> statement-breakpoint
CREATE TYPE "public"."roster_acquired_via" AS ENUM('draft', 'trade', 'commissioner_assign');--> statement-breakpoint
CREATE TYPE "public"."roster_status" AS ENUM('valid', 'invalid_over_limit');--> statement-breakpoint
CREATE TYPE "public"."spatial_topology" AS ENUM('global', 'district');--> statement-breakpoint
CREATE TYPE "public"."temporal_topology" AS ENUM('season_long', 'single_event', 'weekly_event_draft');--> statement-breakpoint
CREATE TYPE "public"."draft_status" AS ENUM('scheduled', 'in_progress', 'paused', 'completed');--> statement-breakpoint
CREATE TYPE "public"."draft_type" AS ENUM('snake');--> statement-breakpoint
CREATE TYPE "public"."trade_asset_type" AS ENUM('team', 'draft_pick');--> statement-breakpoint
CREATE TYPE "public"."trade_status" AS ENUM('proposed', 'accepted', 'rejected', 'vetoed', 'executed', 'reverted');--> statement-breakpoint
CREATE TYPE "public"."tiebreaker_stat" AS ENUM('avg_raw_alliance_score', 'opr');--> statement-breakpoint
CREATE TYPE "public"."api_source" AS ENUM('tba', 'statbotics');--> statement-breakpoint
CREATE TYPE "public"."ingestion_run_status" AS ENUM('running', 'success', 'failed');--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"user_agent" text,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" text NOT NULL,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "league_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"league_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "league_role" DEFAULT 'manager' NOT NULL,
	"team_name" text NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "league_members_league_user_unique" UNIQUE("league_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "leagues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"invite_code" text NOT NULL,
	"commissioner_id" uuid NOT NULL,
	"spatial_topology" "spatial_topology" NOT NULL,
	"district_key" text,
	"temporal_topology" "temporal_topology" NOT NULL,
	"tba_event_key" text,
	"season_year" integer NOT NULL,
	"roster_size" integer DEFAULT 7 NOT NULL,
	"status" "league_status" DEFAULT 'setup' NOT NULL,
	"trade_window_open_day" smallint DEFAULT 1 NOT NULL,
	"trade_window_open_time" time DEFAULT '08:00' NOT NULL,
	"trade_window_close_day" smallint DEFAULT 3 NOT NULL,
	"trade_window_close_time" time DEFAULT '23:59' NOT NULL,
	"trade_window_timezone" text DEFAULT 'America/New_York' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leagues_invite_code_unique" UNIQUE("invite_code"),
	CONSTRAINT "district_key_required_for_district_leagues" CHECK ("leagues"."spatial_topology" = 'global' OR "leagues"."district_key" IS NOT NULL),
	CONSTRAINT "event_key_required_for_event_leagues" CHECK ("leagues"."temporal_topology" = 'season_long' OR "leagues"."tba_event_key" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "roster_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"roster_id" uuid NOT NULL,
	"team_key" text NOT NULL,
	"acquired_via" "roster_acquired_via" NOT NULL,
	"acquired_at" timestamp with time zone DEFAULT now() NOT NULL,
	"dropped_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "rosters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"league_member_id" uuid NOT NULL,
	"status" "roster_status" DEFAULT 'valid' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rosters_league_member_id_unique" UNIQUE("league_member_id")
);
--> statement-breakpoint
CREATE TABLE "draft_picks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"draft_id" uuid NOT NULL,
	"pick_number" integer NOT NULL,
	"round" integer NOT NULL,
	"league_member_id" uuid NOT NULL,
	"team_key" text,
	"made_at" timestamp with time zone,
	"is_autopick" boolean DEFAULT false NOT NULL,
	CONSTRAINT "draft_picks_draft_pick_number_unique" UNIQUE("draft_id","pick_number")
);
--> statement-breakpoint
CREATE TABLE "drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"league_id" uuid NOT NULL,
	"draft_type" "draft_type" DEFAULT 'snake' NOT NULL,
	"status" "draft_status" DEFAULT 'scheduled' NOT NULL,
	"scheduled_start_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"current_pick_number" integer DEFAULT 1 NOT NULL,
	"seconds_per_pick" integer DEFAULT 90 NOT NULL,
	"pick_order" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "drafts_league_id_unique" UNIQUE("league_id")
);
--> statement-breakpoint
CREATE TABLE "trade_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trade_id" uuid NOT NULL,
	"from_member_id" uuid NOT NULL,
	"to_member_id" uuid NOT NULL,
	"asset_type" "trade_asset_type" NOT NULL,
	"team_key" text,
	"draft_pick_id" uuid,
	CONSTRAINT "exactly_one_asset_reference" CHECK (("trade_assets"."asset_type" = 'team' AND "trade_assets"."team_key" IS NOT NULL AND "trade_assets"."draft_pick_id" IS NULL) OR
          ("trade_assets"."asset_type" = 'draft_pick' AND "trade_assets"."draft_pick_id" IS NOT NULL AND "trade_assets"."team_key" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "trade_parties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trade_id" uuid NOT NULL,
	"league_member_id" uuid NOT NULL,
	"accepted" boolean,
	CONSTRAINT "trade_parties_trade_member_unique" UNIQUE("trade_id","league_member_id")
);
--> statement-breakpoint
CREATE TABLE "trades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"league_id" uuid NOT NULL,
	"status" "trade_status" DEFAULT 'proposed' NOT NULL,
	"proposed_by_member_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"executed_at" timestamp with time zone,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "manager_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"league_id" uuid NOT NULL,
	"league_member_id" uuid NOT NULL,
	"event_key" text,
	"total_points" numeric DEFAULT '0' NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scoring_rulesets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"league_id" uuid NOT NULL,
	"rookie_bonus_first_year" integer DEFAULT 10 NOT NULL,
	"rookie_bonus_second_year" integer DEFAULT 5 NOT NULL,
	"tiebreaker_1" "tiebreaker_stat" DEFAULT 'avg_raw_alliance_score' NOT NULL,
	"tiebreaker_2" "tiebreaker_stat" DEFAULT 'opr' NOT NULL,
	"formula_version" text DEFAULT 'first_district_v1' NOT NULL,
	CONSTRAINT "scoring_rulesets_league_id_unique" UNIQUE("league_id")
);
--> statement-breakpoint
CREATE TABLE "team_event_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_key" text NOT NULL,
	"event_key" text NOT NULL,
	"qualification_points" numeric DEFAULT '0' NOT NULL,
	"alliance_selection_points" numeric DEFAULT '0' NOT NULL,
	"playoff_points" numeric DEFAULT '0' NOT NULL,
	"award_points" numeric DEFAULT '0' NOT NULL,
	"rookie_bonus_points" numeric DEFAULT '0' NOT NULL,
	"total_points" numeric DEFAULT '0' NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_event_scores_unique" UNIQUE("team_key","event_key")
);
--> statement-breakpoint
CREATE TABLE "awards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_key" text NOT NULL,
	"event_key" text NOT NULL,
	"award_type" integer NOT NULL,
	"name" text NOT NULL,
	"year" integer NOT NULL,
	"recipient_name" text,
	CONSTRAINT "awards_unique" UNIQUE("event_key","award_type","team_key","recipient_name")
);
--> statement-breakpoint
CREATE TABLE "districts" (
	"key" text PRIMARY KEY NOT NULL,
	"abbreviation" text NOT NULL,
	"display_name" text NOT NULL,
	"year" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "epa_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_key" text NOT NULL,
	"year" integer NOT NULL,
	"event_key" text,
	"epa_mean" numeric NOT NULL,
	"epa_max" numeric,
	"captured_at" timestamp with time zone NOT NULL,
	"source" text DEFAULT 'statbotics' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_teams" (
	"event_key" text NOT NULL,
	"team_key" text NOT NULL,
	CONSTRAINT "event_teams_event_key_team_key_pk" PRIMARY KEY("event_key","team_key")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"key" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"short_name" text,
	"event_type" integer NOT NULL,
	"district_key" text,
	"city" text,
	"state_prov" text,
	"country" text,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"year" integer NOT NULL,
	"week" integer,
	"timezone" text,
	"website" text,
	"webcasts" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"key" text PRIMARY KEY NOT NULL,
	"event_key" text NOT NULL,
	"comp_level" text NOT NULL,
	"set_number" integer NOT NULL,
	"match_number" integer NOT NULL,
	"red_teams" jsonb NOT NULL,
	"blue_teams" jsonb NOT NULL,
	"red_score" integer,
	"blue_score" integer,
	"winning_alliance" text,
	"score_breakdown" jsonb,
	"actual_time" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oprs" (
	"event_key" text NOT NULL,
	"team_key" text NOT NULL,
	"opr" numeric NOT NULL,
	"dpr" numeric NOT NULL,
	"ccwm" numeric NOT NULL,
	CONSTRAINT "oprs_event_key_team_key_pk" PRIMARY KEY("event_key","team_key")
);
--> statement-breakpoint
CREATE TABLE "rankings" (
	"event_key" text NOT NULL,
	"team_key" text NOT NULL,
	"rank" integer NOT NULL,
	"ranking_points" numeric NOT NULL,
	"wins" integer NOT NULL,
	"losses" integer NOT NULL,
	"ties" integer NOT NULL,
	"played" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rankings_event_key_team_key_pk" PRIMARY KEY("event_key","team_key")
);
--> statement-breakpoint
CREATE TABLE "team_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_key" text NOT NULL,
	"year" integer NOT NULL,
	"media_type" text NOT NULL,
	"direct_url" text,
	"avatar_blob" text,
	"avatar_content_type" text,
	"tba_foreign_key" text,
	"cached_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_media_unique" UNIQUE("team_key","year","media_type","tba_foreign_key")
);
--> statement-breakpoint
CREATE TABLE "team_year_stats" (
	"team_key" text NOT NULL,
	"year" integer NOT NULL,
	"wins" integer DEFAULT 0 NOT NULL,
	"losses" integer DEFAULT 0 NOT NULL,
	"ties" integer DEFAULT 0 NOT NULL,
	"events_played" integer DEFAULT 0 NOT NULL,
	"avg_opr" numeric,
	"avg_epa" numeric,
	CONSTRAINT "team_year_stats_team_key_year_pk" PRIMARY KEY("team_key","year")
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"key" text PRIMARY KEY NOT NULL,
	"team_number" integer NOT NULL,
	"nickname" text,
	"name" text,
	"city" text,
	"state_prov" text,
	"country" text,
	"rookie_year" integer,
	"website" text,
	"motto" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teams_team_number_unique" UNIQUE("team_number")
);
--> statement-breakpoint
CREATE TABLE "api_cache_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" "api_source" NOT NULL,
	"endpoint_key" text NOT NULL,
	"etag" text,
	"response_body" jsonb,
	"status_code" text NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_cache_entries_source_endpoint_unique" UNIQUE("source","endpoint_key")
);
--> statement-breakpoint
CREATE TABLE "ingestion_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_name" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" "ingestion_run_status" DEFAULT 'running' NOT NULL,
	"summary" jsonb,
	"error_message" text
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_members" ADD CONSTRAINT "league_members_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_members" ADD CONSTRAINT "league_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leagues" ADD CONSTRAINT "leagues_commissioner_id_users_id_fk" FOREIGN KEY ("commissioner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leagues" ADD CONSTRAINT "leagues_district_key_districts_key_fk" FOREIGN KEY ("district_key") REFERENCES "public"."districts"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leagues" ADD CONSTRAINT "leagues_tba_event_key_events_key_fk" FOREIGN KEY ("tba_event_key") REFERENCES "public"."events"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_slots" ADD CONSTRAINT "roster_slots_roster_id_rosters_id_fk" FOREIGN KEY ("roster_id") REFERENCES "public"."rosters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_slots" ADD CONSTRAINT "roster_slots_team_key_teams_key_fk" FOREIGN KEY ("team_key") REFERENCES "public"."teams"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rosters" ADD CONSTRAINT "rosters_league_member_id_league_members_id_fk" FOREIGN KEY ("league_member_id") REFERENCES "public"."league_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_picks" ADD CONSTRAINT "draft_picks_draft_id_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."drafts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_picks" ADD CONSTRAINT "draft_picks_league_member_id_league_members_id_fk" FOREIGN KEY ("league_member_id") REFERENCES "public"."league_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_picks" ADD CONSTRAINT "draft_picks_team_key_teams_key_fk" FOREIGN KEY ("team_key") REFERENCES "public"."teams"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_assets" ADD CONSTRAINT "trade_assets_trade_id_trades_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_assets" ADD CONSTRAINT "trade_assets_from_member_id_league_members_id_fk" FOREIGN KEY ("from_member_id") REFERENCES "public"."league_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_assets" ADD CONSTRAINT "trade_assets_to_member_id_league_members_id_fk" FOREIGN KEY ("to_member_id") REFERENCES "public"."league_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_assets" ADD CONSTRAINT "trade_assets_team_key_teams_key_fk" FOREIGN KEY ("team_key") REFERENCES "public"."teams"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_assets" ADD CONSTRAINT "trade_assets_draft_pick_id_draft_picks_id_fk" FOREIGN KEY ("draft_pick_id") REFERENCES "public"."draft_picks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_parties" ADD CONSTRAINT "trade_parties_trade_id_trades_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_parties" ADD CONSTRAINT "trade_parties_league_member_id_league_members_id_fk" FOREIGN KEY ("league_member_id") REFERENCES "public"."league_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_proposed_by_member_id_league_members_id_fk" FOREIGN KEY ("proposed_by_member_id") REFERENCES "public"."league_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_scores" ADD CONSTRAINT "manager_scores_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_scores" ADD CONSTRAINT "manager_scores_league_member_id_league_members_id_fk" FOREIGN KEY ("league_member_id") REFERENCES "public"."league_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_scores" ADD CONSTRAINT "manager_scores_event_key_events_key_fk" FOREIGN KEY ("event_key") REFERENCES "public"."events"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scoring_rulesets" ADD CONSTRAINT "scoring_rulesets_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_event_scores" ADD CONSTRAINT "team_event_scores_team_key_teams_key_fk" FOREIGN KEY ("team_key") REFERENCES "public"."teams"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_event_scores" ADD CONSTRAINT "team_event_scores_event_key_events_key_fk" FOREIGN KEY ("event_key") REFERENCES "public"."events"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "awards" ADD CONSTRAINT "awards_team_key_teams_key_fk" FOREIGN KEY ("team_key") REFERENCES "public"."teams"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "awards" ADD CONSTRAINT "awards_event_key_events_key_fk" FOREIGN KEY ("event_key") REFERENCES "public"."events"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "epa_snapshots" ADD CONSTRAINT "epa_snapshots_team_key_teams_key_fk" FOREIGN KEY ("team_key") REFERENCES "public"."teams"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "epa_snapshots" ADD CONSTRAINT "epa_snapshots_event_key_events_key_fk" FOREIGN KEY ("event_key") REFERENCES "public"."events"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_teams" ADD CONSTRAINT "event_teams_event_key_events_key_fk" FOREIGN KEY ("event_key") REFERENCES "public"."events"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_teams" ADD CONSTRAINT "event_teams_team_key_teams_key_fk" FOREIGN KEY ("team_key") REFERENCES "public"."teams"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_district_key_districts_key_fk" FOREIGN KEY ("district_key") REFERENCES "public"."districts"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_event_key_events_key_fk" FOREIGN KEY ("event_key") REFERENCES "public"."events"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oprs" ADD CONSTRAINT "oprs_event_key_events_key_fk" FOREIGN KEY ("event_key") REFERENCES "public"."events"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oprs" ADD CONSTRAINT "oprs_team_key_teams_key_fk" FOREIGN KEY ("team_key") REFERENCES "public"."teams"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rankings" ADD CONSTRAINT "rankings_event_key_events_key_fk" FOREIGN KEY ("event_key") REFERENCES "public"."events"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rankings" ADD CONSTRAINT "rankings_team_key_teams_key_fk" FOREIGN KEY ("team_key") REFERENCES "public"."teams"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_media" ADD CONSTRAINT "team_media_team_key_teams_key_fk" FOREIGN KEY ("team_key") REFERENCES "public"."teams"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_year_stats" ADD CONSTRAINT "team_year_stats_team_key_teams_key_fk" FOREIGN KEY ("team_key") REFERENCES "public"."teams"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "awards_team_idx" ON "awards" USING btree ("team_key");--> statement-breakpoint
CREATE INDEX "epa_snapshots_team_year_idx" ON "epa_snapshots" USING btree ("team_key","year");--> statement-breakpoint
CREATE INDEX "events_year_idx" ON "events" USING btree ("year");--> statement-breakpoint
CREATE INDEX "events_district_idx" ON "events" USING btree ("district_key");--> statement-breakpoint
CREATE INDEX "matches_event_idx" ON "matches" USING btree ("event_key");--> statement-breakpoint
CREATE INDEX "team_media_team_year_idx" ON "team_media" USING btree ("team_key","year");