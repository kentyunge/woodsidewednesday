import { allocateStrokes, classifyScore, isComplete } from "@/lib/scoring";
import { computeStandings, priorDiffs, type MatchView, type ResolvedSide, type SeasonData, type StandingRow, type WeekView } from "../league";

/** How a hole went relative to what this golfer usually makes there. */
export type HoleVerdict = "great" | "good" | "expected" | "bad" | "disaster";

export interface HoleFact {
  hole: number;
  par: number;
  /** Stroke index: 1 = hardest. */
  difficulty: number;
  gross: number;
  /** Par plus the strokes this golfer's handicap gives them on the hole. */
  expected: number;
  vsExpected: number;
  /** Gross score name (birdie, bogey, …), for flavor. */
  grossName: string;
  verdict: HoleVerdict;
}

export interface GolferFact {
  name: string;
  /** "regular", or "sub" when filling in for someone. */
  role: "regular" | "sub";
  subFor: string | null;
  handicap: number | null;
  /** Average gross over their last rounds before tonight, or null if they have no history. */
  typicalGross: number | null;
  gross: number | null;
  net: number | null;
  /** Tonight minus their typical gross (negative = better than usual). */
  vsTypical: number | null;
  holes: HoleFact[];
  highlights: string[];
  lowlights: string[];
}

export interface MatchFact {
  a: string;
  b: string | null;
  aNote: string | null;
  bNote: string | null;
  aPoints: number | null;
  bPoints: number | null;
  result: string;
  strokes: string | null;
}

export interface StandingFact {
  rank: number;
  name: string;
  points: number;
  record: string;
  /** Places gained (positive) or lost (negative) this week. */
  movement: number;
}

export interface RecapFacts {
  league: string;
  season: string;
  week: number;
  date: string;
  positionNight: boolean;
  par: number;
  incompleteMatches: number;
  matches: MatchFact[];
  golfers: GolferFact[];
  lowGross: { name: string; gross: number } | null;
  lowNet: { name: string; net: number } | null;
  standings: StandingFact[];
  nextWeek: { week: number; date: string; positionNight: boolean; matchups: string[] } | null;
}

const GROSS_NAMES: Record<string, string> = {
  eagle: "eagle or better",
  birdie: "birdie",
  par: "par",
  bogey: "bogey",
  double: "double bogey",
  other: "triple bogey or worse",
};

function verdictFor(vsExpected: number): HoleVerdict {
  if (vsExpected <= -2) return "great";
  if (vsExpected === -1) return "good";
  if (vsExpected === 0 || vsExpected === 1) return "expected";
  if (vsExpected === 2) return "bad";
  return "disaster";
}

const round1 = (n: number) => Math.round(n * 10) / 10;

function golferFact(data: SeasonData, week: WeekView, side: ResolvedSide): GolferFact | null {
  if (!side.player || !isComplete(side.scores, data.holes.length)) return null;
  const handicap = side.handicap.handicap;
  const received = allocateStrokes(Math.max(0, handicap ?? 0), data.holes);
  const holes: HoleFact[] = data.holes.map((h, i) => {
    const gross = (side.scores as number[])[i];
    const expected = h.par + received[i];
    return {
      hole: h.number,
      par: h.par,
      difficulty: h.handicap,
      gross,
      expected,
      vsExpected: gross - expected,
      grossName: GROSS_NAMES[classifyScore(gross, h.par)],
      verdict: verdictFor(gross - expected),
    };
  });
  const gross = holes.reduce((s, h) => s + h.gross, 0);
  const prior = priorDiffs(data.history, side.player.id, week.date).slice(-data.rules.rollingRounds);
  const typicalGross = prior.length ? round1(prior.reduce((s, d) => s + d, 0) / prior.length + data.par) : null;

  const describe = (h: HoleFact) =>
    `#${h.hole} (par ${h.par}): ${h.gross}, a ${h.grossName}; they'd usually make ${h.expected} here`;
  return {
    name: side.player.name,
    role: side.status === "sub" ? "sub" : "regular",
    subFor: side.status === "sub" ? side.owner.name : null,
    handicap,
    typicalGross,
    gross,
    net: handicap === null ? null : gross - handicap,
    vsTypical: typicalGross === null ? null : round1(gross - typicalGross),
    holes,
    highlights: holes.filter((h) => h.verdict === "great" || h.verdict === "good").map(describe),
    lowlights: holes.filter((h) => h.verdict === "bad" || h.verdict === "disaster").map(describe),
  };
}

function sideNote(side: ResolvedSide): string | null {
  if (side.status === "sub" && side.player) return `absent; ${side.player.name} subbed in`;
  if (side.status === "ghost") return `absent with no sub; played against ${side.ghost?.name ?? "a random"}'s card as a ghost and earns 0 points`;
  return null;
}

function matchFact(m: MatchView): MatchFact {
  if (!m.b) return { a: m.a.owner.name, b: null, aNote: null, bNote: null, aPoints: null, bPoints: null, result: "bye", strokes: null };
  const r = m.result;
  const aPts = r?.complete ? m.a.pointsAwarded : null;
  const bPts = r?.complete ? m.b.pointsAwarded : null;
  let result = "incomplete: scores not all entered";
  if (aPts !== null && bPts !== null) {
    result = aPts === bPts ? `tied ${aPts}-${bPts}` : `${aPts > bPts ? m.a.owner.name : m.b.owner.name} won ${Math.max(aPts, bPts)}-${Math.min(aPts, bPts)}`;
  }
  let strokes: string | null = null;
  if (r?.strokesTo) {
    const [giver, taker] = r.strokesTo === "A" ? [m.b, m.a] : [m.a, m.b];
    strokes = `${(giver.player ?? giver.owner).name} gave ${r.strokeDifference} stroke${r.strokeDifference === 1 ? "" : "s"} to ${(taker.player ?? taker.owner).name}`;
  }
  return { a: m.a.owner.name, b: m.b.owner.name, aNote: sideNote(m.a), bNote: sideNote(m.b), aPoints: aPts, bPoints: bPts, result, strokes };
}

export function buildRecapFacts(data: SeasonData, weekId: number, league = "Woodside Wednesday"): RecapFacts {
  const week = data.weeks.find((w) => w.id === weekId);
  if (!week) throw new Error(`Week ${weekId} is not in ${data.season.name}`);

  const golfers = week.matches
    .flatMap((m) => [m.a, m.b])
    .filter((s): s is ResolvedSide => !!s)
    .map((s) => golferFact(data, week, s))
    .filter((g): g is GolferFact => !!g);

  const scored = golfers.filter((g) => g.gross !== null);
  const lowG = [...scored].sort((a, b) => a.gross! - b.gross!)[0];
  const lowN = [...scored].filter((g) => g.net !== null).sort((a, b) => a.net! - b.net!)[0];

  // Standings after this week vs before it, to show who climbed and who slid.
  const upTo = (n: number) => data.matches.filter((m) => m.weekNumber <= n);
  const after = computeStandings(data.players, upTo(week.number), () => null);
  const before = computeStandings(data.players, upTo(week.number - 1), () => null);
  const standings: StandingFact[] = after.map((r: StandingRow) => ({
    rank: r.rank,
    name: r.golfer.name,
    points: r.points,
    record: `${r.wins}-${r.losses}-${r.ties}`,
    movement: (before.find((b) => b.golfer.id === r.golfer.id)?.rank ?? r.rank) - r.rank,
  }));

  const next = data.weeks.find((w) => w.number === week.number + 1) ?? null;

  return {
    league,
    season: data.season.name,
    week: week.number,
    date: week.date,
    positionNight: week.kind === "position",
    par: data.par,
    incompleteMatches: week.matches.filter((m) => !m.complete).length,
    matches: week.matches.map(matchFact),
    golfers,
    lowGross: lowG ? { name: lowG.name, gross: lowG.gross! } : null,
    lowNet: lowN ? { name: lowN.name, net: lowN.net! } : null,
    standings,
    nextWeek: next
      ? {
          week: next.number,
          date: next.date,
          positionNight: next.kind === "position",
          matchups: next.matches.map((m) => (m.b ? `${m.a.owner.name} vs ${m.b.owner.name}` : `${m.a.owner.name} (bye)`)),
        }
      : null,
  };
}
