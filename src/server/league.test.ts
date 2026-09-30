import { beforeAll, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { golfers, historicalRounds, matchEntries, user, weeks } from "@/db/schema";
import { addDays } from "@/lib/dates";
import { linkGolferForUser, type Actor } from "./access";
import {
  addHistoricalRounds,
  createGolfer,
  createSeason,
  deleteSeason,
  generatePositionNight,
  generateSchedule,
  importHistoricalCsv,
  listSeasonSummaries,
  postponeWeek,
  setSeasonPlayers,
  updateGolfer,
} from "./admin";
import { ensureDefaultCourse } from "./bootstrap";
import { golferRounds, listSubs } from "./golfers";
import { loadSeason } from "./league";
import { buildRecapFacts } from "./recap/facts";
import { renderRecapEmail } from "./recap/email";
import { completeWeek, reopenWeek } from "./recap";
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

  it("builds recap facts judged against each golfer's own game", async () => {
    const data = await loadSeason(seasonId);
    const week = data.weeks.find((w) => w.number === scoredWeek)!;
    const facts = buildRecapFacts(data, week.id);
    const names = facts.golfers.map((g) => g.name).sort();
    expect(names).toEqual(["A", "B", "Sub S"]); // the ghost side played no round

    // A: handicap 9 gets a stroke on every hole, so bogey is "expected"; card(12) adds one more on holes 1-3.
    const a = facts.golfers.find((g) => g.name === "A")!;
    expect(a.handicap).toBe(9);
    expect(a.holes.every((h) => h.expected === h.par + 1)).toBe(true);
    expect(a.holes.slice(0, 3).map((h) => h.vsExpected)).toEqual([1, 1, 1]);
    expect(a.holes.slice(3).every((h) => h.vsExpected === 0)).toBe(true);
    expect(a.typicalGross).toBe(46); // five carried-over rounds at +10
    expect(a.vsTypical).toBe(2);
    expect(a.lowlights).toHaveLength(0); // nothing worse than their usual

    // B: handicap 5 gets strokes only on the five hardest holes (#8, #9, #3, #7, #4).
    const b = facts.golfers.find((g) => g.name === "B")!;
    const strokeHoles = b.holes.filter((h) => h.expected > h.par).map((h) => h.hole).sort((x, y) => x - y);
    expect(strokeHoles).toEqual([3, 4, 7, 8, 9]);

    const sub = facts.golfers.find((g) => g.name === "Sub S")!;
    expect(sub.role).toBe("sub");
    expect(sub.subFor).toBe("C");
    expect(facts.matches.some((m) => /ghost/.test(`${m.aNote} ${m.bNote}`))).toBe(true);
    expect(facts.standings).toHaveLength(4);
    expect(facts.nextWeek?.week).toBe(scoredWeek + 1);
  });

  it("renders the recap email with escaped text, the standings table and next week's matchups", async () => {
    const data = await loadSeason(seasonId);
    const week = data.weeks.find((w) => w.number === scoredWeek)!;
    const facts = buildRecapFacts(data, week.id);
    const email = renderRecapEmail(
      {
        subject: "Carnage at Woodside",
        preheader: "It got ugly",
        sections: [{ heading: "The <wreckage>", paragraphs: ["**A** made a mess & then some"] }],
        signoff: "See you Wednesday",
      },
      facts,
      data.standings,
      "https://example.com",
    );
    expect(email.html).toContain("The &lt;wreckage&gt;");
    expect(email.html).toContain("<strong>A</strong> made a mess &amp; then some");
    expect(email.html).toContain("Standings");
    for (const r of data.standings) expect(email.html).toContain(`<td style="padding:6px 8px;border-bottom:1px solid #eef2ef">${r.golfer.name}</td>`);
    for (const m of facts.nextWeek!.matchups) expect(email.html).toContain(m);
    expect(email.text).toContain("STANDINGS");
    expect(email.text).not.toContain("**");
  });

  it("closing a week locks golfers out, and a missing API key doesn't block closing", async () => {
    const data = await loadSeason(seasonId);
    const week = data.weeks.find((w) => w.number === scoredWeek)!;
    const saved = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    const r = await completeWeek(admin, week.id, { sendRecap: true });
    if (saved) process.env.ANTHROPIC_API_KEY = saved;
    expect(r.week.closedAt).not.toBeNull();
    expect(r.recap).toBeNull();
    expect(r.recapError).toMatch(/ANTHROPIC_API_KEY/);

    const closed = (await loadSeason(seasonId)).weeks.find((w) => w.id === week.id)!;
    expect(closed.closed).toBe(true);
    const golfer: Actor = { ...admin, isAdmin: false, golferId: closed.matches[0].a.owner.id };
    expect(editAccess(golfer, closed.matches[0], { ...closed, lockDate: "2999-01-01" })).toMatchObject({ allowed: false });
    expect(editAccess(admin, closed.matches[0], closed)).toMatchObject({ allowed: true });

    await reopenWeek(week.id);
    expect((await loadSeason(seasonId)).weeks.find((w) => w.id === week.id)!.closed).toBe(false);
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

describe("subs", () => {
  it("adds a sub with previous scores that establish a handicap", async () => {
    const g = await createGolfer({ name: "Sub Established" }, [
      { playedOn: "2025-07-01", gross: 46 },
      { playedOn: "2025-07-08", gross: 44 },
      { playedOn: "2025-07-15", gross: 45 },
    ]);
    const view = await golferRounds(g.id);
    expect(view.isRegular).toBe(false);
    expect(view.rounds.map((r) => r.gross)).toEqual([45, 44, 46]); // newest first
    expect(view.roundsNeeded).toBe(0);
    expect(view.handicap).toMatchObject({ method: "rolling", handicap: 8 }); // avg +9 * .9 = 8.1
  });

  it("keeps a sub provisional until they have enough rounds", async () => {
    const g = await createGolfer({ name: "Sub New" }, [{ playedOn: "2025-07-01", gross: 50 }]);
    const view = await golferRounds(g.id);
    expect(view.handicap.method).toBe("pending");
    expect(view.roundsNeeded).toBe(2);
  });

  it("rejects bad previous scores without creating the sub", async () => {
    const before = (await db.select().from(golfers)).length;
    await expect(createGolfer({ name: "Sub Future" }, [{ playedOn: "2999-01-01", gross: 40 }])).rejects.toThrow(/future/);
    await expect(createGolfer({ name: "Sub Low" }, [{ playedOn: "2025-07-01", gross: 4 }])).rejects.toThrow(/9-hole/);
    expect((await db.select().from(golfers)).length).toBe(before);
  });

  it("lists everyone who isn't a regular in the current season", async () => {
    const subs = await listSubs();
    const names = subs.map((s) => s.golfer.name);
    expect(names).toContain("Sub Established");
    expect(names).toContain("Sub S"); // subbed in during the league flow
    expect(subs.some((s) => ids.includes(s.golfer.id))).toBe(false);
  });

  it("skips out-of-range rows when importing", async () => {
    const r = await importHistoricalCsv("Sub Established, 2025-06-01, 43\nSub Established, 2999-06-01, 43\nSub Established, 2025-06-02, 150");
    expect(r.imported).toBe(1);
    expect(r.errors).toHaveLength(2);
  });
});

describe("deleting a season", () => {
  it("removes its players, schedule and scores but keeps golfers and history", async () => {
    const summary = (await listSeasonSummaries()).find((s) => s.season.id === seasonId)!;
    expect(summary.players).toBe(4);
    expect(summary.weeks).toBe(4);
    expect(summary.scores).toBeGreaterThan(0);

    const golfersBefore = (await db.select().from(golfers)).length;
    const historicalBefore = (await loadSeasonHistoryCount());
    await deleteSeason(seasonId);

    expect((await listSeasonSummaries()).some((s) => s.season.id === seasonId)).toBe(false);
    expect(await db.select().from(weeks).where(eq(weeks.seasonId, seasonId))).toHaveLength(0);
    expect(await db.select().from(matchEntries)).toHaveLength(0);
    expect((await db.select().from(golfers)).length).toBe(golfersBefore);
    expect(await loadSeasonHistoryCount()).toBe(historicalBefore);
    await expect(deleteSeason(seasonId)).rejects.toThrow(/not found/);
  });
});

async function loadSeasonHistoryCount() {
  return (await db.select().from(historicalRounds)).length;
}
