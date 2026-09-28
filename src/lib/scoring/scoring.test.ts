import { describe, expect, it } from "vitest";
import {
  WOODSIDE_HOLES as H,
  allocateStrokes,
  classifyScore,
  computeHandicap,
  positionNight,
  roundHandicap,
  roundRobin,
  scoreMatch,
} from ".";

describe("roundHandicap", () => {
  it("rounds to nearest whole number, halves away from zero", () => {
    expect(roundHandicap(8.1)).toBe(8);
    expect(roundHandicap(8.5)).toBe(9);
    expect(roundHandicap(8.49)).toBe(8);
    expect(roundHandicap(-1.5)).toBe(-2);
  });
});

describe("computeHandicap", () => {
  it("uses 90% of the last 5 rounds once established", () => {
    // oldest first; only the last five (10,8,9,12,6 => avg 9) count
    const r = computeHandicap([30, 10, 8, 9, 12, 6], null);
    expect(r.method).toBe("rolling");
    expect(r.basis).toEqual([10, 8, 9, 12, 6]);
    expect(r.raw).toBeCloseTo(8.1);
    expect(r.handicap).toBe(8);
  });

  it("averages what is available after 3 rounds", () => {
    const r = computeHandicap([9, 10, 11], 30);
    expect(r.method).toBe("rolling");
    expect(r.handicap).toBe(9); // 10 * .9
  });

  it("uses 80% of the night's round before a golfer is established", () => {
    const r = computeHandicap([9, 10], 12); // 48 on par 36
    expect(r.method).toBe("provisional");
    expect(r.raw).toBeCloseTo(9.6);
    expect(r.handicap).toBe(10);
  });

  it("is pending until a provisional golfer's card is complete", () => {
    expect(computeHandicap([], null)).toMatchObject({ handicap: null, method: "pending" });
  });
});

describe("allocateStrokes", () => {
  it("gives strokes on the hardest holes first", () => {
    // 3 strokes -> handicap 1,2,3 = holes 8, 9, 3
    expect(allocateStrokes(3, H)).toEqual([0, 0, 1, 0, 0, 0, 0, 1, 1]);
  });
  it("wraps when difference exceeds 9", () => {
    // 11 -> one everywhere + second on hdcp 1 & 2 (holes 8, 9)
    expect(allocateStrokes(11, H)).toEqual([1, 1, 1, 1, 1, 1, 1, 2, 2]);
  });
  it("gives nothing for zero or negative", () => {
    expect(allocateStrokes(0, H).every((s) => s === 0)).toBe(true);
  });
});

describe("scoreMatch", () => {
  it("awards 2 points per hole and 2 for net total, 20 in all", () => {
    const a = { handicap: 5, scores: [5, 6, 5, 4, 5, 5, 5, 4, 6] }; // 45
    const b = { handicap: 2, scores: [4, 5, 5, 3, 4, 4, 5, 4, 6] }; // 40
    const m = scoreMatch(H, a, b);
    expect(m.strokesTo).toBe("A");
    expect(m.strokeDifference).toBe(3);
    // A gets strokes on holes 8, 9, 3
    expect(m.holes.map((h) => h.a.strokes)).toEqual([0, 0, 1, 0, 0, 0, 0, 1, 1]);
    expect(m.a.gross).toBe(45);
    expect(m.a.net).toBe(42);
    expect(m.b.net).toBe(40);
    expect(m.a.points + m.b.points).toBe(20);
    // hole 3: A 5-1=4 vs B 5 -> A; hole 8: 4-1=3 vs 4 -> A; hole 9: 5 vs 6 -> A; hole 7 tie
    expect(m.holes[2].a.points).toBe(2);
    expect(m.holes[6].a.points).toBe(1);
    expect(m.b.totalPoints).toBe(2);
    expect(m.complete).toBe(true);
  });

  it("splits ties on the total", () => {
    const s = [4, 5, 4, 3, 4, 4, 4, 3, 5];
    const m = scoreMatch(H, { handicap: 4, scores: s }, { handicap: 4, scores: s });
    expect(m.strokesTo).toBeNull();
    expect(m.a.points).toBe(10);
    expect(m.b.points).toBe(10);
  });

  it("scores partial cards hole by hole but not the total", () => {
    const m = scoreMatch(
      H,
      { handicap: 0, scores: [4, null, null, null, null, null, null, null, null] },
      { handicap: 0, scores: [5, null, null, null, null, null, null, null, null] },
    );
    expect(m.a.holePoints).toBe(2);
    expect(m.a.totalPoints).toBeNull();
    expect(m.complete).toBe(false);
  });
});

describe("classifyScore", () => {
  it("classifies relative to par", () => {
    expect(classifyScore(1, 3)).toBe("eagle");
    expect(classifyScore(3, 5)).toBe("eagle");
    expect(classifyScore(3, 4)).toBe("birdie");
    expect(classifyScore(4, 4)).toBe("par");
    expect(classifyScore(5, 4)).toBe("bogey");
    expect(classifyScore(6, 4)).toBe("double");
    expect(classifyScore(9, 4)).toBe("other");
  });
});

describe("schedule", () => {
  it("12 players play everyone exactly once over 11 weeks", () => {
    const players = Array.from({ length: 12 }, (_, i) => i);
    const rounds = roundRobin(players);
    expect(rounds).toHaveLength(11);
    const seen = new Set<string>();
    for (const round of rounds) {
      expect(round).toHaveLength(6);
      const inRound = round.flat();
      expect(new Set(inRound).size).toBe(12);
      for (const [x, y] of round) {
        const key = [x, y].sort().join("-");
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
    }
    expect(seen.size).toBe(66);
  });

  it("gives byes with an odd count", () => {
    const rounds = roundRobin([1, 2, 3]);
    expect(rounds).toHaveLength(3);
    expect(rounds.every((r) => r.some(([, y]) => y === null))).toBe(true);
  });

  it("pairs position night 1v2, 3v4", () => {
    expect(positionNight(["a", "b", "c", "d"])).toEqual([["a", "b"], ["c", "d"]]);
  });
});
