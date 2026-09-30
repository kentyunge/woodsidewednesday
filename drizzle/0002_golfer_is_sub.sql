ALTER TABLE "golfers" ADD COLUMN "is_sub" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Until now a sub was anyone not on a season roster.
UPDATE "golfers" SET "is_sub" = true WHERE "id" NOT IN (SELECT "golfer_id" FROM "season_players");
