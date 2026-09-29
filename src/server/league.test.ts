import { beforeAll, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { golfers, matchEntries, user, weeks } from "@/db/schema";
import { addDays } from "@/lib/dates";
import { linkGolferForUser, type Actor } from "./access";
import {
  addHistoricalRounds,
  createGolfer,
  createSeason,
  generatePositionNight,
  generateSchedule,
  postponeWeek,
  setSeasonPlayers,
  updateGolfer,
} from "./admin";
import { ensureDefaultCourse } from "./bootstrap";
import { loadSeason } from "./league";
import { editAccess, saveEntry } from "./scores";

const admin: Actor = { userId: "admin-user", name: "Admin", email: "a@x", username: null, isAdmin: true, golferId: null };
const card = (over: number) => {
  // par card 4,5,4,3,4,4,4,3,5 plus `over` strokes spread from hole 1
  const par = [4, 5, 4, 3, 4, 4, 4, 3, 5];
  return par.map((p, i) => p + Math.floor(over / 9) + (i < over % 9 ? 1 : 0));
};

let seasonId: number;
let ids: number[];
let scoredWeek: number;

beforeAll(async () => {
  await migrate(db as never, { migrationsFolder: "drizzle" });
  await ensureDefaultCourse();
  await db.insert(user).values({ id: "admin-user", name: "Admin", email: "a@x", role: "admin" });
  const golfers = await Promise.all(["A", "B", "C", "D"].map((n) => createGolfer({ name: n })));
  ids = golfers.map((g) => g.id);
  // A and B carry over 5 rounds (+10 and +5 avg); C and D have none.
  await addHistoricalRounds([
    ...[10, 10, 10, 10, 10].map((d, i) => ({ golferId: ids[0], playedOn: `2025-06-0${i + 1}`, gross: 36 + d })),
    ...[5, 5, 5, 5, 5].map((d, i) => ({ golferId: ids[1], playedOn: `2025-06-0${i + 1}`, gross: 36 + d })),
  ]);
  const s = await createSeason({ name: "Test", year: 2026, startDate: "2026-05-06", status: "active" });
  seasonId = s.id;
  await setSeasonPlayers(seasonId, ids);
});

describe("golfer logins", () => {
  const addUser = async (id: string, email: string) => {
    await db.insert(user).values({ id, name: id, email });
  };

  it("links a new login to the golfer with that email", async () => {
    const g = await createGolfer({ name: "Linky", email: "Linky@Example.com" });
    await addUser("u-linky", "linky@example.com");
    expect(await linkGolferForUser("u-linky", "linky@example.com")).toBe(g.id);
    expect(await linkGolferForUser("u-other", "nobody@example.com")).toBeNull();
  });

  it("moves an existing login to the golfer's new email", async () => {
    const g = await createGolfer({ name: "Mover", email: "mover@test.local" });
    await addUser("u-mover", "mover@test.local");
    await linkGolferForUser("u-mover", "mover@test.local");
    const updated = await updateGolfer(g.id, { email: "mover@real.com" });
    expect(updated.userId).toBe("u-mover");
    const [u] = await db.select().from(user).where(eq(user.id, "u-mover"));
    expect(u.email).toBe("mover@real.com");
  });

  it("attaches the login they already made with the new email", async () => {
    const g = await createGolfer({ name: "Dup", email: "dup@test.local" });
    await addUser("u-dup-old", "dup@test.local");
    await linkGolferForUser("u-dup-old", "dup@test.local");
    await addUser("u-dup-new", "dup@real.com"); // signed in with real email before the admin fixed it
    const updated = await updateGolfer(g.id, { email: "dup@real.com" });
    expect(updated.userId).toBe("u-dup-new");
    expect(await linkGolferForUser("u-dup-new", "dup@real.com")).toBe(g.id);
  });

  it("repairs a stale link at sign-in when the email was changed in the old code path", async () => {
    const g = await createGolfer({ name: "Stale", email: "stale@test.local" });
    await addUser("u-stale-old", "stale@test.local");
    await linkGolferForUser("u-stale-old", "stale@test.local");
    // Simulate the earlier bug: golfer email changed without moving the login.
    await db.update(golfers).set({ email: "stale@real.com" }).where(eq(golfers.id, g.id));
    await addUser("u-stale-new", "stale@real.com");
    expect(await linkGolferForUser("u-stale-new", "stale@real.com")).toBe(g.id);
    // The old test login no longer maps to the golfer.
    expect(await linkGolferForUser("u-stale-old", "stale@test.local")).toBeNull();
  });
});

describe("league flow", () => {
  it("generates a round robin plus position night", async () => {
    const data = await generateSchedule(seasonId);
    expect(data.weeks).toHaveLength(4);
    expect(data.weeks.map((w) => w.date)).toEqual(["2026-05-06", "2026-05-13", "2026-05-20", "2026-05-27"]);
    expect(data.weeks[3].kind).toBe("position");
    expect(data.weeks.slice(0, 3).every((w) => w.matches.length === 2)).toBe(true);
  });

  it("scores a week with established, provisional, sub and ghost sides", async () => {
    let data = await loadSeason(seasonId);
    const isAB = (m: (typeof data.matches)[number]) => [m.a.owner.id, m.b!.owner.id].sort().join() === [ids[0], ids[1]].sort().join();
    const week = data.weeks.find((w) => w.matches.some(isAB))!;
    scoredWeek = week.number;
    const mAB = week.matches.find(isAB)!;
    const mCD = week.matches.find((m) => m !== mAB)!;

    // A: hcp 0.9 * 10 = 9; B: 0.9 * 5 = 4.5 -> 5
    await saveEntry(admin, mAB.id, mAB.a.owner.id === ids[0] ? "A" : "B", { status: "played", scores: card(12) });
    await saveEntry(admin, mAB.id, mAB.a.owner.id === ids[0] ? "B" : "A", { status: "played", scores: card(6) });
    // C is replaced by a brand-new sub (provisional 80% of tonight). D is absent -> ghost of A's card.
    const cSide = mCD.a.owner.id === ids[2] ? "A" : "B";
    const dSide = cSide === "A" ? "B" : "A";
    await saveEntry(admin, mCD.id, cSide, { status: "sub", newSubName: "Sub S", scores: card(15) });
    await saveEntry(admin, mCD.id, dSide, { status: "ghost", ghostId: ids[0] });

    data = await loadSeason(seasonId);
    const ab = data.matches.find((m) => m.id === mAB.id)!;
    const hA = ab.a.owner.id === ids[0] ? ab.a : ab.b!;
    const hB = ab.a.owner.id === ids[0] ? ab.b! : ab.a;
    expect(hA.handicap).toMatchObject({ handicap: 9, method: "rolling" });
    expect(hB.handicap).toMatchObject({ handicap: 5, method: "rolling" });
    expect(ab.result!.complete).toBe(true);
    expect(ab.result!.a.points + ab.result!.b.points).toBe(20);

    const cd = data.matches.find((m) => m.id === mCD.id)!;
    const sub = cd.a.status === "sub" ? cd.a : cd.b!;
    const ghost = cd.a.status === "ghost" ? cd.a : cd.b!;
    expect(sub.player!.name).toBe("Sub S");
    expect(sub.handicap).toMatchObject({ handicap: 12, method: "provisional" }); // 15 * .8
    expect(ghost.scores).toEqual(hA.scores);
    expect(ghost.handicap.handicap).toBe(9);
    expect(ghost.pointsAwarded).toBe(0); // absent golfer earns nothing
    expect(sub.pointsAwarded).toBe(cd.result![cd.a === sub ? "a" : "b"].points);
    expect(data.weeks.find((w) => w.id === week.id)!.complete).toBe(true);

    // Sub's round goes on the sub's history; the owner's standings get the points.
    const cRow = data.standings.find((s) => s.golfer.id === ids[2])!;
    expect(cRow.points).toBe(sub.pointsAwarded);
    expect(data.history.get(sub.player!.id)).toHaveLength(1);
  });

  it("locks golfer edits at the next week's date", async () => {
    const data = await loadSeason(seasonId);
    const w = data.weeks[0];
    const m = w.matches[0];
    const golfer: Actor = { ...admin, isAdmin: false, golferId: m.a.owner.id };
    expect(w.lockDate).toBe("2026-05-13");
    expect(editAccess(golfer, m, w)).toMatchObject({ allowed: false }); // today is past 2026-05-13
    expect(editAccess({ ...golfer, golferId: -1 }, m, w)).toMatchObject({ allowed: false });
    expect(editAccess(admin, m, w)).toMatchObject({ allowed: true });
  });

  it("postpones a week and everything after it", async () => {
    const [w2] = await db.select().from(weeks).where(eq(weeks.number, 2));
    await postponeWeek(w2.id, "Rainout");
    const data = await loadSeason(seasonId);
    expect(data.weeks.map((w) => w.date)).toEqual(["2026-05-06", "2026-05-20", "2026-05-27", "2026-06-03"]);
    expect(data.weeks[1].notes).toContain("Postponed from 2026-05-13 (Rainout)");
    expect(data.weeks[1].postponements).toBe(1);
    expect(addDays("2026-05-27", 7)).toBe("2026-06-03");
  });

  it("pairs position night from standings", async () => {
    const before = await loadSeason(seasonId);
    const r = await generatePositionNight(seasonId);
    const order = before.standings.map((s) => s.golfer.id);
    expect(r.pairs).toEqual([
      [order[0], order[1]],
      [order[2], order[3]],
    ]);
    expect(r.incompleteWeeks).toEqual([1, 2, 3].filter((n) => n !== scoredWeek));
  });

  it("rejects bad cards", async () => {
    const data = await loadSeason(seasonId);
    const m = data.weeks.find((w) => w.number !== scoredWeek && w.kind === "regular")!.matches[0];
    await expect(saveEntry(admin, m.id, "A", { status: "played", scores: [4, 4] })).rejects.toThrow(/9 hole scores/);
    await expect(saveEntry(admin, m.id, "A", { status: "ghost" })).rejects.toThrow(/other complete card/);
    expect((await db.select().from(matchEntries)).length).toBeGreaterThan(0);
  });
});
