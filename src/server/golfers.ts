import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { golfers, seasonPlayers, seasons, weeks } from "@/db/schema";
import { computeHandicap, DEFAULT_HANDICAP_RULES, type HandicapResult, type HandicapRules } from "@/lib/scoring";
import { notFound } from "./errors";
import { getCurrentSeason, loadCoursePars, loadHistory, rulesFor, type Golfer, type RoundRecord } from "./league";

export interface RoundLine extends RoundRecord {
  seasonName: string | null;
  weekNumber: number | null;
}

export interface GolferRounds {
  golfer: Golfer;
  /** A regular in the current season (otherwise a sub). */
  isRegular: boolean;
  rules: HandicapRules;
  /** Handicap going into the golfer's next round. */
  handicap: HandicapResult;
  /** Rounds still needed before the handicap is established (0 once it is). */
  roundsNeeded: number;
  /** Every round on record, newest first. */
  rounds: RoundLine[];
}

async function currentRules(): Promise<HandicapRules> {
  const season = await getCurrentSeason();
  return season ? rulesFor(season) : DEFAULT_HANDICAP_RULES;
}

function handicapFrom(rounds: RoundRecord[], rules: HandicapRules) {
  const handicap = computeHandicap(
    rounds.map((r) => r.diff),
    null,
    rules,
  );
  return { handicap, roundsNeeded: Math.max(0, rules.establishRounds - rounds.length) };
}

export async function golferRounds(golferId: number): Promise<GolferRounds> {
  const [golfer] = await db.select().from(golfers).where(eq(golfers.id, golferId));
  if (!golfer) throw notFound("Golfer not found");
  const season = await getCurrentSeason();
  const [history, weekRows, seasonRows, regular] = await Promise.all([
    loadCoursePars().then(loadHistory),
    db.select({ id: weeks.id, number: weeks.number }).from(weeks),
    db.select({ id: seasons.id, name: seasons.name }).from(seasons),
    season
      ? db
          .select({ id: seasonPlayers.golferId })
          .from(seasonPlayers)
          .where(and(eq(seasonPlayers.seasonId, season.id), eq(seasonPlayers.golferId, golferId)))
      : Promise.resolve([]),
  ]);
  const rules = season ? rulesFor(season) : DEFAULT_HANDICAP_RULES;
  const rounds = history.get(golferId) ?? [];
  return {
    golfer,
    isRegular: regular.length > 0,
    rules,
    ...handicapFrom(rounds, rules),
    rounds: rounds
      .map((r) => ({
        ...r,
        weekNumber: weekRows.find((w) => w.id === r.weekId)?.number ?? null,
        seasonName: seasonRows.find((s) => s.id === r.seasonId)?.name ?? null,
      }))
      .reverse(),
  };
}

export interface SubRow {
  golfer: Golfer;
  rounds: number;
  lastPlayed: string | null;
  handicap: HandicapResult;
  roundsNeeded: number;
}

/** Active golfers flagged as subs. */
export async function listSubs(): Promise<SubRow[]> {
  const [subs, history, rules] = await Promise.all([
    db
      .select()
      .from(golfers)
      .where(and(eq(golfers.active, true), eq(golfers.isSub, true)))
      .orderBy(asc(golfers.name)),
    loadCoursePars().then(loadHistory),
    currentRules(),
  ]);
  return subs.map((golfer) => {
    const rounds = history.get(golfer.id) ?? [];
    return { golfer, rounds: rounds.length, lastPlayed: rounds.at(-1)?.date ?? null, ...handicapFrom(rounds, rules) };
  });
}
