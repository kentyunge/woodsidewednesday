import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export * from "./auth-schema";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const courses = pgTable("courses", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  ...timestamps,
});

export const holes = pgTable(
  "holes",
  {
    id: serial("id").primaryKey(),
    courseId: integer("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    par: integer("par").notNull(),
    handicap: integer("handicap").notNull(),
  },
  (t) => [unique().on(t.courseId, t.number)],
);

/** Anyone who has ever played: regulars and subs. Optionally linked to a login. */
export const golfers = pgTable("golfers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").unique(),
  phone: text("phone"),
  userId: text("user_id")
    .unique()
    .references(() => user.id, { onDelete: "set null" }),
  active: boolean("active").notNull().default(true),
  ...timestamps,
});

export const seasons = pgTable("seasons", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  year: integer("year").notNull(),
  courseId: integer("course_id")
    .notNull()
    .references(() => courses.id),
  status: text("status", { enum: ["upcoming", "active", "completed"] })
    .notNull()
    .default("upcoming"),
  startDate: date("start_date").notNull(),
  handicapPercent: real("handicap_percent").notNull().default(0.9),
  provisionalPercent: real("provisional_percent").notNull().default(0.8),
  rollingRounds: integer("rolling_rounds").notNull().default(5),
  establishRounds: integer("establish_rounds").notNull().default(3),
  ...timestamps,
});

/** The regulars in a season. `tiebreak` is a random draw used to break standings ties. */
export const seasonPlayers = pgTable(
  "season_players",
  {
    seasonId: integer("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    golferId: integer("golfer_id")
      .notNull()
      .references(() => golfers.id, { onDelete: "cascade" }),
    tiebreak: real("tiebreak")
      .notNull()
      .default(sql`random()`),
  },
  (t) => [primaryKey({ columns: [t.seasonId, t.golferId] })],
);

export const weeks = pgTable(
  "weeks",
  {
    id: serial("id").primaryKey(),
    seasonId: integer("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    date: date("date").notNull(),
    kind: text("kind", { enum: ["regular", "position"] })
      .notNull()
      .default("regular"),
    /** Times this week has been pushed back (rainouts). */
    postponements: integer("postponements").notNull().default(0),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [unique().on(t.seasonId, t.number)],
);

export const matches = pgTable("matches", {
  id: serial("id").primaryKey(),
  weekId: integer("week_id")
    .notNull()
    .references(() => weeks.id, { onDelete: "cascade" }),
  golferAId: integer("golfer_a_id")
    .notNull()
    .references(() => golfers.id),
  /** null = bye */
  golferBId: integer("golfer_b_id").references(() => golfers.id),
  ...timestamps,
});

/**
 * One side of a match. `golferId` on the match owns the points; this row says who
 * actually played for that side and their card.
 *  - played: the scheduled golfer played
 *  - sub:    `playerId` subbed in
 *  - ghost:  nobody played; the side uses `ghostId`'s card and handicap from the same week
 */
export const matchEntries = pgTable(
  "match_entries",
  {
    id: serial("id").primaryKey(),
    matchId: integer("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    side: text("side", { enum: ["A", "B"] }).notNull(),
    status: text("status", { enum: ["played", "sub", "ghost"] })
      .notNull()
      .default("played"),
    playerId: integer("player_id").references(() => golfers.id),
    ghostId: integer("ghost_id").references(() => golfers.id),
    scores: jsonb("scores").$type<(number | null)[]>(),
    handicapOverride: integer("handicap_override"),
    playedOn: date("played_on"),
    updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [unique().on(t.matchId, t.side)],
);

/** Rounds from before the app (e.g. last season's sheet) that seed handicaps. */
export const historicalRounds = pgTable("historical_rounds", {
  id: serial("id").primaryKey(),
  golferId: integer("golfer_id")
    .notNull()
    .references(() => golfers.id, { onDelete: "cascade" }),
  playedOn: date("played_on").notNull(),
  gross: integer("gross").notNull(),
  par: integer("par").notNull().default(36),
  note: text("note"),
  ...timestamps,
});
