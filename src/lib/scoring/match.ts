import { allocateStrokes } from "./strokes";
import { POINTS_FOR_TOTAL, POINTS_PER_HOLE, type Hole, type HoleScores } from "./types";

export interface MatchSideInput {
  handicap: number | null;
  scores: HoleScores | null;
}

export interface HoleResult {
  hole: number;
  par: number;
  handicap: number;
  a: { gross: number | null; strokes: number; net: number | null; points: number | null };
  b: { gross: number | null; strokes: number; net: number | null; points: number | null };
}

export interface MatchResult {
  holes: HoleResult[];
  /** Which side receives strokes, and how many. */
  strokesTo: "A" | "B" | null;
  strokeDifference: number;
  a: SideTotals;
  b: SideTotals;
  /** True when both cards are complete and handicaps known. */
  complete: boolean;
}

export interface SideTotals {
  gross: number | null;
  net: number | null;
  holePoints: number;
  totalPoints: number | null;
  points: number;
}

export function isComplete(scores: HoleScores | null | undefined, holeCount: number): scores is number[] {
  return !!scores && scores.length === holeCount && scores.every((s) => typeof s === "number");
}

function award(x: number, y: number, pts: number): [number, number] {
  if (x < y) return [pts, 0];
  if (y < x) return [0, pts];
  return [pts / 2, pts / 2];
}

/** Score a match hole by hole plus the total-strokes points. */
export function scoreMatch(holes: Hole[], a: MatchSideInput, b: MatchSideInput): MatchResult {
  const handicapsKnown = a.handicap !== null && b.handicap !== null;
  const diff = handicapsKnown ? Math.abs(a.handicap! - b.handicap!) : 0;
  const strokesTo: "A" | "B" | null =
    !handicapsKnown || diff === 0 ? null : a.handicap! > b.handicap! ? "A" : "B";
  const alloc = allocateStrokes(diff, holes);

  const result: HoleResult[] = holes.map((h, i) => {
    const ga = a.scores?.[i] ?? null;
    const gb = b.scores?.[i] ?? null;
    const sa = strokesTo === "A" ? alloc[i] : 0;
    const sb = strokesTo === "B" ? alloc[i] : 0;
    const na = ga === null ? null : ga - sa;
    const nb = gb === null ? null : gb - sb;
    let pa: number | null = null;
    let pb: number | null = null;
    if (handicapsKnown && na !== null && nb !== null) [pa, pb] = award(na, nb, POINTS_PER_HOLE);
    return {
      hole: h.number,
      par: h.par,
      handicap: h.handicap,
      a: { gross: ga, strokes: sa, net: na, points: pa },
      b: { gross: gb, strokes: sb, net: nb, points: pb },
    };
  });

  const totals = (side: "a" | "b", input: MatchSideInput): Omit<SideTotals, "totalPoints" | "points"> => {
    const done = isComplete(input.scores, holes.length);
    const gross = done ? (input.scores as number[]).reduce((s, v) => s + v, 0) : null;
    const received = result.reduce((s, r) => s + r[side].strokes, 0);
    return {
      gross,
      net: gross === null ? null : gross - received,
      holePoints: result.reduce((s, r) => s + (r[side].points ?? 0), 0),
    };
  };
  const ta = totals("a", a);
  const tb = totals("b", b);

  let tpa: number | null = null;
  let tpb: number | null = null;
  if (handicapsKnown && ta.net !== null && tb.net !== null) [tpa, tpb] = award(ta.net, tb.net, POINTS_FOR_TOTAL);

  return {
    holes: result,
    strokesTo,
    strokeDifference: diff,
    a: { ...ta, totalPoints: tpa, points: ta.holePoints + (tpa ?? 0) },
    b: { ...tb, totalPoints: tpb, points: tb.holePoints + (tpb ?? 0) },
    complete: tpa !== null,
  };
}
