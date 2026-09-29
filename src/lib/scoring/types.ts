export interface Hole {
  number: number;
  par: number;
  /** Stroke index: 1 = hardest hole on the card. */
  handicap: number;
}

/** A 9-hole card. `null` = hole not entered yet. */
export type HoleScores = (number | null)[];

export interface HandicapRules {
  /** Fraction applied to the rolling average once established (e.g. 0.9). */
  percent: number;
  /** Fraction applied to the night's own round before a golfer is established (e.g. 0.8). */
  provisionalPercent: number;
  /** Number of most recent rounds in the rolling average (e.g. 5). */
  rollingRounds: number;
  /** Prior rounds needed to establish a handicap (e.g. 3). */
  establishRounds: number;
}

export const DEFAULT_HANDICAP_RULES: HandicapRules = {
  percent: 0.9,
  provisionalPercent: 0.8,
  rollingRounds: 5,
  establishRounds: 3,
};

export const POINTS_PER_HOLE = 2;
export const POINTS_FOR_TOTAL = 2;
