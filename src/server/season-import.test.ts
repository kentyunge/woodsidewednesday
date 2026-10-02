import { beforeAll, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { golfers, seasons } from "@/db/schema";
import { createGolfer } from "./admin";
import { loadSeason } from "./league";
import { importSeason, type SeasonImport } from "./season-import";

const card = (n: number) => Array(9).fill(n);

function payload(name = "Imported 2025"): SeasonImport {
  return {
    season: { name, year: 2025, startDate: "2025-05-28", handicapPercent: 0.95 },
    players: ["imp-a", "imp-b", "imp-c", "imp-d"].map((u) => ({ email: `${u}@test.local` })),
    previousRounds: [45, 45, 45].map((gross, i) => ({ email: "IMP-A@test.local", playedOn: `2024-08-0${i + 1}`, gross })),
    weeks: [
      {
        number: 1,
        date: "2025-05-28",
        matches: [
          { a: { golfer: "imp-a@test.local", scores: card(5) }, b: { golfer: "imp-b@test.local", scores: card(4) } },
          { a: { golfer: "imp-c@test.local", sub: "Imp Sub", scores: card(5) }, b: { golfer: "imp-d@test.local", scores: card(6) } },
        ],
      },
    ],
  };
}

beforeAll(async () => {
  await migrate(db as never, { migrationsFolder: "drizzle" });
  for (const u of ["a", "b", "c", "d"]) await createGolfer({ name: `Imp ${u.toUpperCase()}`, email: `imp-${u}@test.local` });
});

describe("season import", () => {
  it("checks a file without saving it on a dry run", async () => {
    const r = await importSeason(payload(), { dryRun: true });
    expect(r).toMatchObject({ dryRun: true, seasonId: null, previousRounds: 3, weeks: 1, matches: 2, cards: 4, newSubs: ["Imp Sub"] });
    expect(await db.select().from(seasons).where(eq(seasons.name, "Imported 2025"))).toHaveLength(0);
  });

  it("imports players, earlier rounds, schedule, cards and subs", async () => {
    const r = await importSeason(payload());
    const data = await loadSeason(r.seasonId!);
    expect(data.season).toMatchObject({ name: "Imported 2025", status: "completed", handicapPercent: 0.95 });
    expect(data.players.map((p) => p.name).sort()).toEqual(["Imp A", "Imp B", "Imp C", "Imp D"]);
    expect(data.weeks[0].closed).toBe(true);

    const [m1, m2] = data.matches;
    // 95% of +9 over par from the earlier rounds = 8.55 -> 9
    expect(m1.a.handicap).toMatchObject({ handicap: 9, method: "rolling" });
    expect(m1.complete).toBe(true);
    expect(m2.a).toMatchObject({ status: "sub", player: { name: "Imp Sub" } });
    const [sub] = await db.select().from(golfers).where(eq(golfers.name, "Imp Sub"));
    expect(sub.isSub).toBe(true);
  });

  it("refuses to import the same season twice", async () => {
    await expect(importSeason(payload())).rejects.toThrow(/already exists/);
  });

  it("reports unknown golfers and saves nothing", async () => {
    const bad = payload("Bad import");
    bad.players[0] = { email: "nobody@test.local", name: "Nobody" };
    await expect(importSeason(bad)).rejects.toThrow(/No golfer has the email nobody@test.local \(Nobody\)/);
    expect(await db.select().from(seasons).where(eq(seasons.name, "Bad import"))).toHaveLength(0);
  });
});
