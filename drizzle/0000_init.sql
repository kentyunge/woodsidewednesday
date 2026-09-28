CREATE TABLE "courses" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "golfers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"user_id" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "golfers_email_unique" UNIQUE("email"),
	CONSTRAINT "golfers_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "historical_rounds" (
	"id" serial PRIMARY KEY NOT NULL,
	"golfer_id" integer NOT NULL,
	"played_on" date NOT NULL,
	"gross" integer NOT NULL,
	"par" integer DEFAULT 36 NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "holes" (
	"id" serial PRIMARY KEY NOT NULL,
	"course_id" integer NOT NULL,
	"number" integer NOT NULL,
	"par" integer NOT NULL,
	"handicap" integer NOT NULL,
	CONSTRAINT "holes_course_id_number_unique" UNIQUE("course_id","number")
);
--> statement-breakpoint
CREATE TABLE "match_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"match_id" integer NOT NULL,
	"side" text NOT NULL,
	"status" text DEFAULT 'played' NOT NULL,
	"player_id" integer,
	"ghost_id" integer,
	"scores" jsonb,
	"handicap_override" integer,
	"played_on" date,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "match_entries_match_id_side_unique" UNIQUE("match_id","side")
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" serial PRIMARY KEY NOT NULL,
	"week_id" integer NOT NULL,
	"golfer_a_id" integer NOT NULL,
	"golfer_b_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "season_players" (
	"season_id" integer NOT NULL,
	"golfer_id" integer NOT NULL,
	"tiebreak" real DEFAULT random() NOT NULL,
	CONSTRAINT "season_players_season_id_golfer_id_pk" PRIMARY KEY("season_id","golfer_id")
);
--> statement-breakpoint
CREATE TABLE "seasons" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"year" integer NOT NULL,
	"course_id" integer NOT NULL,
	"status" text DEFAULT 'upcoming' NOT NULL,
	"start_date" date NOT NULL,
	"handicap_percent" real DEFAULT 0.9 NOT NULL,
	"provisional_percent" real DEFAULT 0.8 NOT NULL,
	"rolling_rounds" integer DEFAULT 5 NOT NULL,
	"establish_rounds" integer DEFAULT 3 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weeks" (
	"id" serial PRIMARY KEY NOT NULL,
	"season_id" integer NOT NULL,
	"number" integer NOT NULL,
	"date" date NOT NULL,
	"kind" text DEFAULT 'regular' NOT NULL,
	"postponements" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "weeks_season_id_number_unique" UNIQUE("season_id","number")
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"username" text,
	"display_username" text,
	"role" text DEFAULT 'golfer',
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "golfers" ADD CONSTRAINT "golfers_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historical_rounds" ADD CONSTRAINT "historical_rounds_golfer_id_golfers_id_fk" FOREIGN KEY ("golfer_id") REFERENCES "public"."golfers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holes" ADD CONSTRAINT "holes_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_entries" ADD CONSTRAINT "match_entries_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_entries" ADD CONSTRAINT "match_entries_player_id_golfers_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."golfers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_entries" ADD CONSTRAINT "match_entries_ghost_id_golfers_id_fk" FOREIGN KEY ("ghost_id") REFERENCES "public"."golfers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_entries" ADD CONSTRAINT "match_entries_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_week_id_weeks_id_fk" FOREIGN KEY ("week_id") REFERENCES "public"."weeks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_golfer_a_id_golfers_id_fk" FOREIGN KEY ("golfer_a_id") REFERENCES "public"."golfers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_golfer_b_id_golfers_id_fk" FOREIGN KEY ("golfer_b_id") REFERENCES "public"."golfers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "season_players" ADD CONSTRAINT "season_players_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "season_players" ADD CONSTRAINT "season_players_golfer_id_golfers_id_fk" FOREIGN KEY ("golfer_id") REFERENCES "public"."golfers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weeks" ADD CONSTRAINT "weeks_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");