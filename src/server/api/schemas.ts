import { z } from "@hono/zod-openapi";

export const DateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).openapi({ example: "2026-05-06" });
export const IdParam = z.object({ id: z.coerce.number().int().positive().openapi({ param: { name: "id", in: "path" } }) });
export const ErrorSchema = z.object({ error: z.string() }).openapi("Error");
export const OkSchema = z.object({ ok: z.literal(true) }).openapi("Ok");

export const GolferRef = z.object({ id: z.number(), name: z.string() }).openapi("GolferRef");

export const Golfer = z
  .object({
    id: z.number(),
    name: z.string(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    userId: z.string().nullable(),
    active: z.boolean(),
  })
  .openapi("Golfer");

export const GolferInput = z
  .object({
    name: z.string().min(1),
    email: z.email().nullish(),
    phone: z.string().nullish(),
    active: z.boolean().optional(),
  })
  .openapi("GolferInput");

export const NewGolferInput = GolferInput.extend({
  previousRounds: z
    .array(z.object({ playedOn: DateStr, gross: z.number().int() }))
    .optional()
    .openapi({ description: "Earlier 9-hole gross scores (par 36) that count toward their handicap" }),
}).openapi("NewGolferInput");

export const HistoricalRound = z
  .object({ id: z.number(), golferId: z.number(), playedOn: z.string(), gross: z.number(), par: z.number(), note: z.string().nullable() })
  .openapi("HistoricalRound");

const HandicapResult = z.object({
  handicap: z.number().nullable(),
  raw: z.number().nullable(),
  method: z.enum(["rolling", "provisional", "pending"]),
  basis: z.array(z.number()),
});

export const GolferRounds = z
  .object({
    golfer: Golfer,
    isRegular: z.boolean().openapi({ description: "A regular in the current season; otherwise a sub" }),
    handicap: HandicapResult,
    roundsNeeded: z.number().openapi({ description: "Rounds still needed to establish a handicap" }),
    rounds: z.array(
      z.object({
        date: z.string(),
        gross: z.number(),
        diff: z.number().openapi({ description: "Strokes over par" }),
        source: z.enum(["match", "historical"]),
        seasonName: z.string().nullable(),
        weekNumber: z.number().nullable(),
        matchId: z.number().optional(),
        historicalId: z.number().optional(),
        note: z.string().nullable().optional(),
      }),
    ),
  })
  .openapi("GolferRounds");

export const SubRow = z
  .object({
    golfer: Golfer,
    rounds: z.number(),
    lastPlayed: z.string().nullable(),
    handicap: HandicapResult,
    roundsNeeded: z.number(),
  })
  .openapi("Sub");

export const Hole = z.object({ number: z.number(), par: z.number(), handicap: z.number() }).openapi("Hole");

const SeasonStatus = z.enum(["upcoming", "active", "completed"]);
export const Season = z
  .object({
    id: z.number(),
    name: z.string(),
    year: z.number(),
    courseId: z.number(),
    status: SeasonStatus,
    startDate: z.string(),
    handicapPercent: z.number(),
    provisionalPercent: z.number(),
    rollingRounds: z.number(),
    establishRounds: z.number(),
  })
  .openapi("Season");

export const SeasonInput = z
  .object({
    name: z.string().min(1),
    year: z.number().int(),
    startDate: DateStr,
    status: SeasonStatus.optional(),
    handicapPercent: z.number().min(0).max(1).optional(),
    provisionalPercent: z.number().min(0).max(1).optional(),
    rollingRounds: z.number().int().min(1).optional(),
    establishRounds: z.number().int().min(0).optional(),
  })
  .openapi("SeasonInput");

const Handicap = z.object({
  handicap: z.number().nullable(),
  raw: z.number().nullable(),
  method: z.enum(["rolling", "provisional", "pending"]),
  basis: z.array(z.number()),
  override: z.boolean(),
});

const Side = z.object({
  owner: GolferRef,
  status: z.enum(["played", "sub", "ghost"]),
  player: GolferRef.nullable(),
  ghost: GolferRef.nullable(),
  scores: z.array(z.number().nullable()).nullable(),
  handicap: Handicap,
  pointsAwarded: z.number(),
  entryId: z.number().nullable(),
});

const HoleSide = z.object({
  gross: z.number().nullable(),
  strokes: z.number(),
  net: z.number().nullable(),
  points: z.number().nullable(),
});
const Totals = z.object({
  gross: z.number().nullable(),
  net: z.number().nullable(),
  holePoints: z.number(),
  totalPoints: z.number().nullable(),
  points: z.number(),
});

export const Match = z
  .object({
    id: z.number(),
    weekId: z.number(),
    weekNumber: z.number(),
    date: z.string(),
    kind: z.enum(["regular", "position"]),
    bye: z.boolean(),
    a: Side,
    b: Side.nullable(),
    complete: z.boolean(),
    result: z
      .object({
        holes: z.array(z.object({ hole: z.number(), par: z.number(), handicap: z.number(), a: HoleSide, b: HoleSide })),
        strokesTo: z.enum(["A", "B"]).nullable(),
        strokeDifference: z.number(),
        a: Totals,
        b: Totals,
        complete: z.boolean(),
      })
      .nullable(),
  })
  .openapi("Match");

export const Week = z
  .object({
    id: z.number(),
    seasonId: z.number(),
    number: z.number(),
    date: z.string(),
    kind: z.enum(["regular", "position"]),
    postponements: z.number(),
    notes: z.string().nullable(),
    lockDate: z.string(),
    complete: z.boolean().openapi({ description: "Every match has a result" }),
    closed: z.boolean().openapi({ description: "The admin marked the week complete" }),
    matches: z.array(Match),
  })
  .openapi("Week");

export const StandingRow = z
  .object({
    rank: z.number(),
    golfer: GolferRef,
    points: z.number(),
    matchesPlayed: z.number(),
    wins: z.number(),
    losses: z.number(),
    ties: z.number(),
    avgPoints: z.number().nullable(),
    handicap: z.number().nullable(),
  })
  .openapi("StandingRow");

const Distribution = z.object({
  eagle: z.number(),
  birdie: z.number(),
  par: z.number(),
  bogey: z.number(),
  double: z.number(),
  other: z.number(),
});
const Leader = z.object({ golfer: GolferRef, value: z.number(), detail: z.string().optional() });

export const LeagueStats = z
  .object({
    distribution: Distribution,
    roundsPlayed: z.number(),
    avgGross: z.number().nullable(),
    lowGross: Leader.nullable(),
    lowNet: Leader.nullable(),
    bestWeek: Leader.nullable(),
    holeDifficulty: z.array(
      z.object({ hole: z.number(), par: z.number(), handicap: z.number(), avg: z.number().nullable(), overPar: z.number().nullable() }),
    ),
    leaders: z.object({ birdies: z.array(Leader), pars: z.array(Leader), scoringAvg: z.array(Leader) }),
    weeklyLows: z.array(z.object({ weekNumber: z.number(), date: z.string(), gross: Leader.nullable(), net: Leader.nullable() })),
  })
  .openapi("LeagueStats");

export const GolferStats = z
  .object({
    golfer: GolferRef,
    rank: z.number().nullable(),
    points: z.number(),
    wins: z.number(),
    losses: z.number(),
    ties: z.number(),
    rounds: z.number(),
    handicap: z.number().nullable(),
    handicapMethod: z.string(),
    distribution: Distribution,
    holesPlayed: z.number(),
    avgGross: z.number().nullable(),
    avgNet: z.number().nullable(),
    lowGross: z.number().nullable(),
    lowNet: z.number().nullable(),
    avgByPar: z.object({ 3: z.number().nullable(), 4: z.number().nullable(), 5: z.number().nullable() }),
    avgByHole: z.array(z.object({ hole: z.number(), par: z.number(), avg: z.number().nullable() })),
    holesWon: z.number(),
    holesHalved: z.number(),
    holesLost: z.number(),
    bestWeekPoints: z.number().nullable(),
    roundsList: z.array(
      z.object({
        matchId: z.number(),
        weekNumber: z.number(),
        date: z.string(),
        opponent: GolferRef.nullable(),
        subFor: GolferRef.nullable(),
        gross: z.number().nullable(),
        net: z.number().nullable(),
        handicap: z.number().nullable(),
        points: z.number().nullable(),
        opponentPoints: z.number().nullable(),
        scores: z.array(z.number().nullable()),
      }),
    ),
    handicapTrend: z.array(z.object({ weekNumber: z.number(), handicap: z.number().nullable() })),
  })
  .openapi("GolferStats");

export const EntryInput = z
  .object({
    status: z.enum(["played", "sub", "ghost"]).default("played"),
    playerId: z.number().int().nullish().openapi({ description: "Sub golfer id when status is 'sub'" }),
    newSubName: z.string().nullish().openapi({ description: "Create a new sub golfer by name" }),
    ghostId: z.number().int().nullish().openapi({ description: "Golfer whose card a ghost uses; omit to draw at random" }),
    scores: z.array(z.number().int().nullable()).nullish().openapi({ description: "Gross score per hole, null = not entered" }),
    handicapOverride: z.number().int().nullish().openapi({ description: "Admin only" }),
    playedOn: DateStr.nullish().openapi({ description: "Actual date played, e.g. a makeup round" }),
  })
  .openapi("EntryInput");

export const Me = z
  .object({
    userId: z.string(),
    name: z.string(),
    email: z.string(),
    username: z.string().nullable(),
    isAdmin: z.boolean(),
    golferId: z.number().nullable(),
    hasPassword: z.boolean(),
  })
  .openapi("Me");

export const Recap = z
  .object({
    id: z.number(),
    weekId: z.number(),
    subject: z.string(),
    model: z.string(),
    sentTo: z.array(z.string()),
  })
  .openapi("Recap");
