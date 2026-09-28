import type { Hole } from "./types";

/**
 * Strokes received on each hole (in card order) for a stroke difference.
 * Strokes go to the hardest holes first and wrap around when the difference
 * exceeds the number of holes.
 */
export function allocateStrokes(difference: number, holes: Hole[]): number[] {
  const n = holes.length;
  const strokes = Math.max(0, difference);
  const base = Math.floor(strokes / n);
  const extra = strokes % n;
  return holes.map((h) => base + (rankOf(h, holes) <= extra ? 1 : 0));
}

/** 1-based difficulty rank within this card (robust to 18-hole style indexes). */
function rankOf(hole: Hole, holes: Hole[]): number {
  return holes.filter((h) => h.handicap < hole.handicap).length + 1;
}
