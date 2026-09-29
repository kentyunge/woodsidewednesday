import { asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  golfers,
  historicalRounds,
  holes as holesTable,
  matchEntries,
  matches,
  seasonPlayers,
  seasons,
  weeks,
} from "@/db/schema";
import { addDays, today } from "@/lib/dates";
import {
  computeHandicap,
  isComplete,
  scoreMatch,
  type HandicapResult,
  type HandicapRules,
  type Hole,
  type HoleScores,
  type MatchResult,
} from "@/lib/scoring";
import { notFound } from "./errors";

export type Season = typeof seasons.$inferSelect;
export type Golfer = typeof golfers.$inferSelect;
export type Week = typeof weeks.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type MatchEntry = typeof matchEntries.$inferSelect;

export interface GolferRef {
  id: number;
  name: string;
}

export interface ResolvedSide {
  /** The scheduled golfer who owns the points. */
  owner: GolferRef;
  status: "played" | "sub" | "ghost";
  /** Who actually played (owner or sub); null for a ghost. */
  player: GolferRef | null;
  /** For ghosts: whose card is being used. */
  ghost: GolferRef | null;
  scores: HoleScores | null;
  handicap: HandicapResult & { override: boolean };
  /** Points credited to the owner in standings (a ghost side earns nothing). */
  pointsAwarded: number;
  entryId: number | null;
  updatedAt: Date | null;
}

export interface MatchView {
  id: number;
  weekId: number;
  weekNumber: number;
  date: string;
  kind: Week["kind"];
  bye: boolean;
  a: ResolvedSide;
  b: ResolvedSide | null;
  result: MatchResult | null;
  complete: boolean;
}

export interface WeekView extends Week {
  matches: MatchView[];
  /** Golfers (non-admin) can enter scores until this date. */
  lockDate: string;
  complete: boolean;
}

export interface StandingRow {
  rank: number;
  golfer: GolferRef;
  points: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  ties: number;
  avgPoints: number | null;
  handicap: number | null;
}

export interface SeasonData {
  season: Season;
  holes: Hole[];
  par: number;
  rules: HandicapRules;
  players: (GolferRef & { tiebreak: number })[];
  golfers: Map<number, Golfer>;
  weeks: WeekView[];
  matches: MatchView[];
  standings: StandingRow[];
  /** Round history per golfer across all seasons (oldest first), used for handicaps. */
  history: Map<number, RoundRecord[]>;
}

export interface RoundRecord {
  date: string;
  diff: number;
  gross: number;
  source: "match" | "historical";
  seasonId: number | null;
  weekId: number | null;
}

export function rulesFor(season: Season): HandicapRules {
  return {
    percent: season.handicapPercent,
    provisionalPercent: season.provisionalPercent,
    rollingRounds: season.rollingRounds,
    establishRounds: season.establishRounds,
  };
}

export async function getSeasons() {
  return db.select().from(seasons).orderBy(desc(seasons.year), desc(seasons.id));
}

/** The active season, else the most recent one. */
export async function getCurrentSeason(): Promise<Season | null> {
  const all = await getSeasons();
  return all.find((s) => s.status === "active") ?? all[0] ?? null;
}

async function loadCoursePars() {
  const rows = await db.select().from(holesTable).orderBy(asc(holesTable.number));
  const byCourse = new Map<number, Hole[]>();
  for (const r of rows) {
    const list = byCourse.get(r.courseId) ?? [];
    list.push({ number: r.number, par: r.par, handicap: r.handicap });
    byCourse.set(r.courseId, list);
  }
  return byCourse;
}

/** Every completed round for every golfer, all seasons, oldest first. */
async function loadHistory(courseHoles: Map<number, Hole[]>): Promise<Map<number, RoundRecord[]>> {
  const rows = await db
    .select({
      status: matchEntries.status,
      playerId: matchEntries.playerId,
      side: matchEntries.side,
      scores: matchEntries.scores,
      golferAId: matches.golferAId,
      golferBId: matches.golferBId,
      weekId: weeks.id,
      date: weeks.date,
      seasonId: seasons.id,
      courseId: seasons.courseId,
    })
    .from(matchEntries)
    .innerJoin(matches, eq(matchEntries.matchId, matches.id))
    .innerJoin(weeks, eq(matches.weekId, weeks.id))
    .innerJoin(seasons, eq(weeks.seasonId, seasons.id));

  const history = new Map<number, RoundRecord[]>();
  const push = (id: number, r: RoundRecord) => {
    const list = history.get(id) ?? [];
    list.push(r);
    history.set(id, list);
  };

  for (const r of rows) {
    if (r.status === "ghost") continue;
    const card = courseHoles.get(r.courseId) ?? [];
    if (!isComplete(r.scores, card.length)) continue;
    const golferId = r.status === "sub" ? r.playerId : r.side === "A" ? r.golferAId : r.golferBId;
    if (!golferId) continue;
    const gross = r.scores.reduce((s, v) => s + v, 0);
    const par = card.reduce((s, h) => s + h.par, 0);
    push(golferId, { date: r.date, diff: gross - par, gross, source: "match", seasonId: r.seasonId, weekId: r.weekId });
  }

  for (const h of await db.select().from(historicalRounds)) {
    push(h.golferId, {
      date: h.playedOn,
      diff: h.gross - h.par,
      gross: h.gross,
      source: "historical",
      seasonId: null,
      weekId: null,
    });
  }

  for (const list of history.values()) list.sort((x, y) => x.date.localeCompare(y.date) || (x.weekId ?? 0) - (y.weekId ?? 0));
  return history;
}

/** Over-par differentials for rounds strictly before `date`. */
export function priorDiffs(history: Map<number, RoundRecord[]>, golferId: number, date: string): number[] {
  return (history.get(golferId) ?? []).filter((r) => r.date < date).map((r) => r.diff);
}

export async function loadSeason(seasonId: number): Promise<SeasonData> {
  const [season] = await db.select().from(seasons).where(eq(seasons.id, seasonId));
  if (!season) throw notFound("Season not found");

  const courseHoles = await loadCoursePars();
  const holes = courseHoles.get(season.courseId) ?? [];
  const par = holes.reduce((s, h) => s + h.par, 0);
  const rules = rulesFor(season);

  const [playerRows, weekRows, allGolfers, history] = await Promise.all([
    db
      .select({ id: golfers.id, name: golfers.name, tiebreak: seasonPlayers.tiebreak })
      .from(seasonPlayers)
      .innerJoin(golfers, eq(seasonPlayers.golferId, golfers.id))
      .where(eq(seasonPlayers.seasonId, seasonId)),
    db.select().from(weeks).where(eq(weeks.seasonId, seasonId)).orderBy(asc(weeks.number)),
    db.select().from(golfers),
    loadHistory(courseHoles),
  ]);
  const golferMap = new Map(allGolfers.map((g) => [g.id, g]));
  const ref = (id: number): GolferRef => ({ id, name: golferMap.get(id)?.name ?? "Unknown" });

  const weekIds = weekRows.map((w) => w.id);
  const matchRows = weekIds.length
    ? await db.select().from(matches).where(inArray(matches.weekId, weekIds)).orderBy(asc(matches.id))
    : [];
  const matchIds = matchRows.map((m) => m.id);
  const entryRows = matchIds.length
    ? await db.select().from(matchEntries).where(inArray(matchEntries.matchId, matchIds))
    : [];
  const entryFor = (matchId: number, side: "A" | "B") =>
    entryRows.find((e) => e.matchId === matchId && e.side === side) ?? null;

  const handicapFor = (golferId: number, date: string, scores: HoleScores | null, override: number | null) => {
    if (override !== null) {
      return { handicap: override, raw: override, method: "rolling" as const, basis: [], override: true };
    }
    const current = isComplete(scores, holes.length) ? scores.reduce((s, v) => s + v, 0) - par : null;
    return { ...computeHandicap(priorDiffs(history, golferId, date), current, rules), override: false };
  };

  // First pass: every side that isn't a ghost.
  type Pending = { match: Match; week: Week; side: "A" | "B"; ownerId: number; entry: MatchEntry | null };
  const resolved = new Map<string, ResolvedSide>();
  const pending: Pending[] = [];
  const key = (matchId: number, side: string) => `${matchId}:${side}`;

  for (const match of matchRows) {
    const week = weekRows.find((w) => w.id === match.weekId)!;
    for (const side of ["A", "B"] as const) {
      const ownerId = side === "A" ? match.golferAId : match.golferBId;
      if (!ownerId) continue;
      const entry = entryFor(match.id, side);
      if (entry?.status === "ghost") {
        pending.push({ match, week, side, ownerId, entry });
        continue;
      }
      const playerId = entry?.status === "sub" && entry.playerId ? entry.playerId : ownerId;
      const scores = entry?.scores ?? null;
      resolved.set(key(match.id, side), {
        owner: ref(ownerId),
        status: entry?.status === "sub" ? "sub" : "played",
        player: ref(playerId),
        ghost: null,
        scores,
        handicap: handicapFor(playerId, week.date, scores, entry?.handicapOverride ?? null),
        pointsAwarded: 0,
        entryId: entry?.id ?? null,
        updatedAt: entry?.updatedAt ?? null,
      });
    }
  }

  // Second pass: ghosts borrow the card and handicap of whoever that golfer played as that week.
  for (const p of pending) {
    const weekMatchIds = matchRows.filter((m) => m.weekId === p.week.id).map((m) => m.id);
    let source: ResolvedSide | undefined;
    for (const id of weekMatchIds) {
      for (const s of ["A", "B"]) {
        const r = resolved.get(key(id, s));
        if (r?.player && r.player.id === p.entry!.ghostId) source = r;
      }
    }
    const override = p.entry!.handicapOverride;
    resolved.set(key(p.match.id, p.side), {
      owner: ref(p.ownerId),
      status: "ghost",
      player: null,
      ghost: p.entry!.ghostId ? ref(p.entry!.ghostId) : null,
      scores: source?.scores ?? null,
      handicap:
        override !== null
          ? { handicap: override, raw: override, method: "rolling", basis: [], override: true }
          : (source?.handicap ?? { handicap: null, raw: null, method: "pending", basis: [], override: false }),
      pointsAwarded: 0,
      entryId: p.entry!.id,
      updatedAt: p.entry!.updatedAt,
    });
  }

  const matchViews: MatchView[] = matchRows.map((match) => {
    const week = weekRows.find((w) => w.id === match.weekId)!;
    const a = resolved.get(key(match.id, "A"))!;
    const b = match.golferBId ? resolved.get(key(match.id, "B"))! : null;
    let result: MatchResult | null = null;
    if (b) {
      result = scoreMatch(
        holes,
        { handicap: a.handicap.handicap, scores: a.scores },
        { handicap: b.handicap.handicap, scores: b.scores },
      );
      if (result.complete) {
        a.pointsAwarded = a.status === "ghost" ? 0 : result.a.points;
        b.pointsAwarded = b.status === "ghost" ? 0 : result.b.points;
      }
    }
    return {
      id: match.id,
      weekId: week.id,
      weekNumber: week.number,
      date: week.date,
      kind: week.kind,
      bye: !b,
      a,
      b,
      result,
      complete: !b || !!result?.complete,
    };
  });

  const weekViews: WeekView[] = weekRows.map((w, i) => {
    const ms = matchViews.filter((m) => m.weekId === w.id);
    return {
      ...w,
      matches: ms,
      lockDate: weekRows[i + 1]?.date ?? addDays(w.date, 7),
      complete: ms.length > 0 && ms.every((m) => m.complete),
    };
  });

  const players = playerRows.map((p) => ({ id: p.id, name: p.name, tiebreak: p.tiebreak }));
  const lastDate = weekRows.at(-1)?.date ?? season.startDate;
  const standings = computeStandings(players, matchViews, (id) =>
    handicapFor(id, addDays(lastDate, 1), null, null).handicap,
  );

  return {
    season,
    holes,
    par,
    rules,
    players,
    golfers: golferMap,
    weeks: weekViews,
    matches: matchViews,
    standings,
    history,
  };
}

export function computeStandings(
  players: (GolferRef & { tiebreak: number })[],
  matchViews: MatchView[],
  currentHandicap: (golferId: number) => number | null,
): StandingRow[] {
  const rows = players.map((p) => {
    let points = 0;
    let played = 0;
    let wins = 0;
    let losses = 0;
    let ties = 0;
    for (const m of matchViews) {
      if (!m.b || !m.result?.complete) continue;
      const mine = m.a.owner.id === p.id ? m.a : m.b.owner.id === p.id ? m.b : null;
      if (!mine) continue;
      played++;
      points += mine.pointsAwarded;
      if (mine.status === "ghost") {
        losses++;
        continue;
      }
      if (mine.pointsAwarded > 10) wins++;
      else if (mine.pointsAwarded < 10) losses++;
      else ties++;
    }
    return {
      golfer: { id: p.id, name: p.name },
      tiebreak: p.tiebreak,
      points,
      matchesPlayed: played,
      wins,
      losses,
      ties,
      avgPoints: played ? points / played : null,
      handicap: currentHandicap(p.id),
    };
  });
  rows.sort((x, y) => y.points - x.points || x.tiebreak - y.tiebreak);
  return rows.map(({ tiebreak, ...r }, i) => {
    void tiebreak;
    return { rank: i + 1, ...r };
  });
}

/** A golfer's handicap going into their next round. */
export function upcomingHandicap(data: SeasonData, golferId: number): HandicapResult {
  return computeHandicap(priorDiffs(data.history, golferId, "9999-12-31"), null, data.rules);
}

/** The week to feature: the next one still open for scores, else the next by date, else the last. */
export function featuredWeek(weeks: WeekView[]): WeekView | undefined {
  const t = today();
  return weeks.find((w) => w.lockDate > t && !w.complete) ?? weeks.find((w) => w.date >= t) ?? weeks.at(-1);
}
