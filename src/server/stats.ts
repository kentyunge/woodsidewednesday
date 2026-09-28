import { classifyScore, emptyDistribution, isComplete, type ScoreType } from "@/lib/scoring";
import { upcomingHandicap, type GolferRef, type MatchView, type SeasonData } from "./league";

export interface RoundLine {
  matchId: number;
  weekNumber: number;
  date: string;
  opponent: GolferRef | null;
  subFor: GolferRef | null;
  gross: number | null;
  net: number | null;
  handicap: number | null;
  points: number | null;
  opponentPoints: number | null;
  scores: (number | null)[];
}

export interface GolferSeasonStats {
  golfer: GolferRef;
  rank: number | null;
  points: number;
  wins: number;
  losses: number;
  ties: number;
  rounds: number;
  handicap: number | null;
  handicapMethod: string;
  distribution: Record<ScoreType, number>;
  holesPlayed: number;
  avgGross: number | null;
  avgNet: number | null;
  lowGross: number | null;
  lowNet: number | null;
  avgByPar: Record<3 | 4 | 5, number | null>;
  avgByHole: { hole: number; par: number; avg: number | null }[];
  holesWon: number;
  holesHalved: number;
  holesLost: number;
  bestWeekPoints: number | null;
  roundsList: RoundLine[];
  handicapTrend: { weekNumber: number; handicap: number | null }[];
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

/** Sides of matches the golfer physically played (as a regular or a sub). */
function sidesPlayedBy(data: SeasonData, golferId: number) {
  const out: { match: MatchView; mine: "a" | "b" }[] = [];
  for (const m of data.matches) {
    if (m.a.player?.id === golferId) out.push({ match: m, mine: "a" });
    else if (m.b?.player?.id === golferId) out.push({ match: m, mine: "b" });
  }
  return out.sort((x, y) => x.match.weekNumber - y.match.weekNumber);
}

export function golferSeasonStats(data: SeasonData, golferId: number): GolferSeasonStats {
  const g = data.golfers.get(golferId);
  const standing = data.standings.find((s) => s.golfer.id === golferId);
  const distribution = emptyDistribution();
  const byHole = data.holes.map(() => [] as number[]);
  const grosses: number[] = [];
  const nets: number[] = [];
  let holesWon = 0;
  let holesHalved = 0;
  let holesLost = 0;
  const roundsList: RoundLine[] = [];

  for (const { match, mine } of sidesPlayedBy(data, golferId)) {
    const side = match[mine]!;
    if (!side.scores?.some((x) => x !== null)) continue; // not played yet
    const theirs = mine === "a" ? match.b : match.a;
    const r = match.result;
    side.scores?.forEach((s, i) => {
      if (s === null) return;
      distribution[classifyScore(s, data.holes[i].par)]++;
      byHole[i].push(s);
    });
    if (r) {
      for (const h of r.holes) {
        const mp = h[mine].points;
        if (mp === null) continue;
        if (mp === 2) holesWon++;
        else if (mp === 1) holesHalved++;
        else holesLost++;
      }
    }
    const totals = r?.[mine];
    if (totals?.gross != null) grosses.push(totals.gross);
    if (totals?.net != null && r?.complete) nets.push(totals.net);
    roundsList.push({
      matchId: match.id,
      weekNumber: match.weekNumber,
      date: match.date,
      opponent: theirs ? theirs.owner : null,
      subFor: side.status === "sub" ? side.owner : null,
      gross: isComplete(side.scores, data.holes.length) ? side.scores.reduce((s, v) => s + v, 0) : null,
      net: r?.complete ? (totals?.net ?? null) : null,
      handicap: side.handicap.handicap,
      points: r?.complete ? (totals?.points ?? null) : null,
      opponentPoints: r?.complete ? (r[mine === "a" ? "b" : "a"].points ?? null) : null,
      scores: side.scores ?? [],
    });
  }

  const parAvg = (par: number) => avg(data.holes.flatMap((h, i) => (h.par === par ? byHole[i] : [])));
  const hcp = upcomingHandicap(data, golferId);
  const ownedPoints = data.matches
    .filter((m) => m.complete && !m.bye)
    .flatMap((m) => [m.a, m.b!].filter((s) => s.owner.id === golferId).map((s) => s.pointsAwarded));

  return {
    golfer: { id: golferId, name: g?.name ?? "Unknown" },
    rank: standing?.rank ?? null,
    points: standing?.points ?? 0,
    wins: standing?.wins ?? 0,
    losses: standing?.losses ?? 0,
    ties: standing?.ties ?? 0,
    rounds: grosses.length,
    handicap: hcp.handicap,
    handicapMethod: hcp.method,
    distribution,
    holesPlayed: byHole.reduce((s, l) => s + l.length, 0),
    avgGross: avg(grosses),
    avgNet: avg(nets),
    lowGross: grosses.length ? Math.min(...grosses) : null,
    lowNet: nets.length ? Math.min(...nets) : null,
    avgByPar: { 3: parAvg(3), 4: parAvg(4), 5: parAvg(5) },
    avgByHole: data.holes.map((h, i) => ({ hole: h.number, par: h.par, avg: avg(byHole[i]) })),
    holesWon,
    holesHalved,
    holesLost,
    bestWeekPoints: ownedPoints.length ? Math.max(...ownedPoints) : null,
    roundsList,
    handicapTrend: roundsList.map((r) => ({ weekNumber: r.weekNumber, handicap: r.handicap })),
  };
}

export interface Leader {
  golfer: GolferRef;
  value: number;
  detail?: string;
}

export interface LeagueStats {
  distribution: Record<ScoreType, number>;
  roundsPlayed: number;
  avgGross: number | null;
  lowGross: Leader | null;
  lowNet: Leader | null;
  bestWeek: Leader | null;
  holeDifficulty: { hole: number; par: number; handicap: number; avg: number | null; overPar: number | null }[];
  leaders: {
    birdies: Leader[];
    pars: Leader[];
    scoringAvg: Leader[];
  };
  weeklyLows: { weekNumber: number; date: string; gross: Leader | null; net: Leader | null }[];
}

export function leagueStats(data: SeasonData): LeagueStats {
  const distribution = emptyDistribution();
  const byHole = data.holes.map(() => [] as number[]);
  const perGolfer = new Map<number, { ref: GolferRef; birdies: number; pars: number; grosses: number[] }>();
  let lowGross: Leader | null = null;
  let lowNet: Leader | null = null;
  let bestWeek: Leader | null = null;
  const weeklyLows: LeagueStats["weeklyLows"] = [];
  const allGross: number[] = [];

  for (const week of data.weeks) {
    let wg: Leader | null = null;
    let wn: Leader | null = null;
    for (const m of week.matches) {
      for (const k of ["a", "b"] as const) {
        const side = m[k];
        if (!side?.player) continue; // ghosts don't count
        const stat = perGolfer.get(side.player.id) ?? { ref: side.player, birdies: 0, pars: 0, grosses: [] };
        perGolfer.set(side.player.id, stat);
        side.scores?.forEach((s, i) => {
          if (s === null) return;
          const t = classifyScore(s, data.holes[i].par);
          distribution[t]++;
          if (t === "birdie") stat.birdies++;
          if (t === "par") stat.pars++;
          byHole[i].push(s);
        });
        const totals = m.result?.[k];
        const detail = `Week ${week.number}`;
        if (totals?.gross != null) {
          stat.grosses.push(totals.gross);
          allGross.push(totals.gross);
          if (!lowGross || totals.gross < lowGross.value) lowGross = { golfer: side.player, value: totals.gross, detail };
          if (!wg || totals.gross < wg.value) wg = { golfer: side.player, value: totals.gross };
        }
        if (m.result?.complete && totals?.net != null) {
          if (!lowNet || totals.net < lowNet.value) lowNet = { golfer: side.player, value: totals.net, detail };
          if (!wn || totals.net < wn.value) wn = { golfer: side.player, value: totals.net };
        }
        if (m.result?.complete && side.pointsAwarded && (!bestWeek || side.pointsAwarded > bestWeek.value)) {
          bestWeek = { golfer: side.owner, value: side.pointsAwarded, detail };
        }
      }
    }
    if (wg || wn) weeklyLows.push({ weekNumber: week.number, date: week.date, gross: wg, net: wn });
  }

  const golfersStats = [...perGolfer.values()];
  const top = (fn: (s: (typeof golfersStats)[number]) => number | null, dir: 1 | -1) =>
    golfersStats
      .map((s) => ({ golfer: s.ref, value: fn(s) }))
      .filter((x): x is Leader => x.value !== null && x.value !== 0)
      .sort((x, y) => dir * (x.value - y.value))
      .slice(0, 5);

  return {
    distribution,
    roundsPlayed: allGross.length,
    avgGross: avg(allGross),
    lowGross,
    lowNet,
    bestWeek,
    holeDifficulty: data.holes.map((h, i) => {
      const a = avg(byHole[i]);
      return { hole: h.number, par: h.par, handicap: h.handicap, avg: a, overPar: a === null ? null : a - h.par };
    }),
    leaders: {
      birdies: top((s) => s.birdies, -1),
      pars: top((s) => s.pars, -1),
      scoringAvg: top((s) => avg(s.grosses), 1),
    },
    weeklyLows,
  };
}
