CREATE INDEX "manager_scores_league_member_idx" ON "manager_scores" USING btree ("league_id","league_member_id");--> statement-breakpoint
CREATE INDEX "manager_scores_league_event_idx" ON "manager_scores" USING btree ("league_id","event_key");--> statement-breakpoint
CREATE INDEX "team_event_scores_event_idx" ON "team_event_scores" USING btree ("event_key");--> statement-breakpoint
ALTER TABLE "team_event_scores" DROP COLUMN "rookie_bonus_points";