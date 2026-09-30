/**
 * Fills a local database with a demo league: 12 golfers, last season's rounds for
 * handicaps, a generated schedule, and scores for the weeks already played.
 *   npm run db:seed-demo
 */
import "dotenv/config";
import { db } from "../src/db";
import { matchEntries, seasons } from "../src/db/schema";
import { addDays, today } from "../src/lib/dates";
import { WOODSIDE_HOLES } from "../src/lib/scoring";
import { addHistoricalRounds, createGolfer, createSeason, generateSchedule, setSeasonPlayers } from "../src/server/admin";
import { ensureDefaultCourse } from "../src/server/bootstrap";
import { loadSeason } from "../src/server/league";

const NAMES = [
  "Alex Carter", "Ben Foster", "Chris Dalton", "Dan Morales", "Eric Hughes", "Frank Owens",
  "Greg Patel", "Hank Silva", "Ian Brooks", "Jake Turner", "Kyle Warren", "Luke Bennett",
];

let seed = 42;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);

/** A 9-hole card for a golfer who averages about `over` strokes over par. */
function card(over: number): number[] {
  return WOODSIDE_HOLES.map((h) => {
    const r = rand();
    const bias = over / 9;
    let d = r < 0.04 ? -1 : r < 0.35 - bias * 0.15 ? 0 : r < 0.75 ? 1 : r < 0.93 ? 2 : 3;
    if (bias < 0.6 && d > 0 && rand() < 0.35) d--;
    return Math.max(1, h.par + d);
  });
}

async function main() {
  if ((await db.select().from(seasons)).length && !process.argv.includes("--force")) {
    console.log("Database already has seasons; pass --force to add another demo season.");
    process.exit(0);
  }
  await ensureDefaultCourse();
  const skill = NAMES.map((_, i) => 3 + i); // 3..14 over par
  const golfers = [];
  for (const [i, name] of NAMES.entries()) {
    golfers.push(await createGolfer({ name, email: `golfer${i + 1}@example.com` }));
  }
  const sub = await createGolfer({ name: "Sam Rivers (sub)", isSub: true });

  // Last season: five rounds each so handicaps are established from week 1.
  const t = today();
  const year = Number(t.slice(0, 4));
  await addHistoricalRounds(
    golfers.flatMap((g, i) =>
      [0, 1, 2, 3, 4].map((k) => ({
        golferId: g.id,
        playedOn: addDays(`${year - 1}-07-01`, 7 * k),
        gross: card(skill[i]).reduce((s, v) => s + v, 0),
        note: "Last season",
      })),
    ),
  );

  // Season started 7 weeks ago on a Wednesday.
  const d = new Date(`${t}T12:00:00Z`);
  const lastWed = addDays(t, -((d.getUTCDay() + 4) % 7));
  const season = await createSeason({ name: `${year} Season`, year, startDate: addDays(lastWed, -42), status: "active" });
  await setSeasonPlayers(season.id, golfers.map((g) => g.id));
  const data = await generateSchedule(season.id);

  for (const week of data.weeks.filter((w) => w.date <= t && w.kind === "regular")) {
    for (const [mi, m] of week.matches.entries()) {
      for (const side of ["A", "B"] as const) {
        const owner = side === "A" ? m.a.owner.id : m.b!.owner.id;
        const idx = golfers.findIndex((g) => g.id === owner);
        if (week.number === 3 && mi === 0 && side === "B") {
          await db.insert(matchEntries).values({ matchId: m.id, side, status: "sub", playerId: sub.id, scores: card(10) });
        } else if (week.number === 5 && mi === 1 && side === "A") {
          const ghostSource = week.matches[2].a.owner.id; // drawn "at random"
          await db.insert(matchEntries).values({ matchId: m.id, side, status: "ghost", ghostId: ghostSource });
        } else {
          await db.insert(matchEntries).values({ matchId: m.id, side, status: "played", scores: card(skill[idx]) });
        }
      }
    }
  }

  const final = await loadSeason(season.id);
  console.log(`Seeded "${season.name}" with ${final.weeks.length} weeks.`);
  console.table(final.standings.map((s) => ({ rank: s.rank, name: s.golfer.name, pts: s.points, hcp: s.handicap, "W-L-T": `${s.wins}-${s.losses}-${s.ties}` })));
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
