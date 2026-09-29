export type ScoreType = "eagle" | "birdie" | "par" | "bogey" | "double" | "other";

export const SCORE_TYPES: ScoreType[] = ["eagle", "birdie", "par", "bogey", "double", "other"];

/** Classify a gross hole score relative to par. Eagle includes anything better. */
export function classifyScore(gross: number, par: number): ScoreType {
  const d = gross - par;
  if (d <= -2) return "eagle";
  if (d === -1) return "birdie";
  if (d === 0) return "par";
  if (d === 1) return "bogey";
  if (d === 2) return "double";
  return "other";
}

export function emptyDistribution(): Record<ScoreType, number> {
  return { eagle: 0, birdie: 0, par: 0, bogey: 0, double: 0, other: 0 };
}
