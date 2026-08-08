ALTER TABLE "draft_picks" DROP CONSTRAINT "draft_picks_league_member_id_league_members_id_fk";
--> statement-breakpoint
ALTER TABLE "draft_picks" ADD CONSTRAINT "draft_picks_league_member_id_league_members_id_fk" FOREIGN KEY ("league_member_id") REFERENCES "public"."league_members"("id") ON DELETE cascade ON UPDATE no action;