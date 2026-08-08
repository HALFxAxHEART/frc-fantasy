ALTER TABLE "league_members" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "league_members" ADD COLUMN "is_bot" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "leagues" ADD COLUMN "is_practice" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "league_members" ADD CONSTRAINT "bot_members_have_no_user" CHECK ("league_members"."is_bot" = true OR "league_members"."user_id" IS NOT NULL);