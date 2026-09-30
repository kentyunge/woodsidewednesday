import { describe, expect, it } from "vitest";
import { splitWeeks } from "./weeks";

const w = (number: number, closed: boolean) => ({ number, closed });

describe("splitWeeks", () => {
  it("makes the earliest open week current and lists completed weeks newest first", () => {
    const { current, upcoming, completed } = splitWeeks([w(1, true), w(2, true), w(3, false), w(4, false), w(5, false)]);
    expect(current?.number).toBe(3);
    expect(upcoming.map((x) => x.number)).toEqual([4, 5]);
    expect(completed.map((x) => x.number)).toEqual([2, 1]);
  });

  it("uses week 1 before anything is complete, and nothing once everything is", () => {
    expect(splitWeeks([w(1, false), w(2, false)]).current?.number).toBe(1);
    const done = splitWeeks([w(1, true), w(2, true)]);
    expect(done.current).toBeNull();
    expect(done.upcoming).toEqual([]);
  });

  it("keeps a reopened earlier week current even when later weeks are complete", () => {
    const { current, completed } = splitWeeks([w(1, true), w(2, false), w(3, true)]);
    expect(current?.number).toBe(2);
    expect(completed.map((x) => x.number)).toEqual([3, 1]);
  });
});
