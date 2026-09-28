import { DEFAULT_HANDICAP_RULES, type HandicapRules } from "./types";

/** Round to the nearest whole number, .5 away from zero. */
export function roundHandicap(value: number): number {
  const rounded = Math.round(Math.abs(value));
  return value < 0 ? -rounded : rounded;
}

export type HandicapMethod = "rolling" | "provisional" | "pending";

export interface HandicapResult {
  /** Whole-number handicap used for the match (null while pending). */
  handicap: number | null;
  /** Unrounded value, for display. */
  raw: number | null;
  method: HandicapMethod;
  /** The over-par differentials that fed the calculation. */
  basis: number[];
}

/**
 * Handicap for one round.
 *
 * @param priorDiffs strokes over par of the golfer's earlier rounds, oldest first
 * @param currentDiff strokes over par of tonight's round, when it's complete
 */
export function computeHandicap(
  priorDiffs: number[],
  currentDiff: number | null,
  rules: HandicapRules = DEFAULT_HANDICAP_RULES,
): HandicapResult {
  if (priorDiffs.length >= rules.establishRounds) {
    const basis = priorDiffs.slice(-rules.rollingRounds);
    const avg = basis.reduce((s, d) => s + d, 0) / basis.length;
    const raw = avg * rules.percent;
    return { handicap: roundHandicap(raw), raw, method: "rolling", basis };
  }
  if (currentDiff === null) {
    return { handicap: null, raw: null, method: "pending", basis: [] };
  }
  const raw = currentDiff * rules.provisionalPercent;
  return { handicap: roundHandicap(raw), raw, method: "provisional", basis: [currentDiff] };
}
