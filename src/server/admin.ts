import { and, asc, eq, gt, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { golfers, historicalRounds, matchEntries, matches, seasonPlayers, seasons, user, weeks } from "@/db/schema";
import { addDays } from "@/lib/dates";
import { positionNight, roundRobin, shuffle } from "@/lib/scoring";
import { ensureDefaultCourse } from "./bootstrap";
import { badRequest, conflict, notFound } from "./errors";
import { loadSeason } from "./league";

// ---------- golfers ----------

export interface GolferInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  active?: boolean;
}

const normEmail = (e?: string | null) => (e ? e.trim().toLowerCase() : null);

export async function listGolfers() {
  return db.select().from(golfers).orderBy(asc(golfers.name));
}

export async function createGolfer(input: GolferInput) {
  const [g] = await db
    .insert(golfers)
    .values({ name: input.name.trim(), email: normEmail(input.email), phone: input.phone ?? null, active: input.active ?? true })
    .returning();
  return g;
}

export async function updateGolfer(id: number, input: Partial<GolferInput>) {
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(golfers).where(eq(golfers.id, id));
    if (!before) throw notFound("Golfer not found");
    const email = input.email !== undefined ? normEmail(input.email) : before.email;
    let userId = before.userId;

    // A changed email carries the golfer's login with it.
    if (email && email !== before.email?.toLowerCase()) {
      const [existing] = await tx.select({ id: user.id }).from(user).where(sql`lower(${user.email}) = ${email}`);
      if (existing) {
        // They already signed in with the new address: attach that login instead.
        userId = existing.id;
        await tx
          .update(golfers)
          .set({ userId: null })
          .where(and(eq(golfers.userId, existing.id), sql`${golfers.id} <> ${id}`));
      } else if (before.userId) {
        // Move their existing login (and any username/password) to the new address.
        await tx.update(user).set({ email, emailVerified: false }).where(eq(user.id, before.userId));
      }
    }

    const [g] = await tx
      .update(golfers)
      .set({
        ...(input.name !== undefined && { name: input.name.trim() }),
        ...(input.email !== undefined && { email }),
        ...(input.phone !== undefined && { phone: input.phone }),
        ...(input.active !== undefined && { active: input.active }),
        userId,
      })
      .where(eq(golfers.id, id))
      .returning();
    return g;
  });
}

// ---------- historical rounds (handicap carry-over) ----------

export async function listHistoricalRounds(golferId?: number) {
  const q = db.select().from(historicalRounds);
  return (golferId ? q.where(eq(historicalRounds.golferId, golferId)) : q).orderBy(asc(historicalRounds.playedOn));
}

export async function addHistoricalRounds(rows: { golferId: number; playedOn: string; gross: number; par?: number; note?: string | null }[]) {
  if (!rows.length) return [];
  return db
    .insert(historicalRounds)
    .values(rows.map((r) => ({ ...r, par: r.par ?? 36, note: r.note ?? null })))
    .returning();
}

export async function deleteHistoricalRound(id: number) {
  await db.delete(historicalRounds).where(eq(historicalRounds.id, id));
}

/**
 * Import pasted CSV lines of `golfer name or email, date, gross` (e.g. copied from
 * last season's Google Sheet). Unknown golfers are created.
 */
export async function importHistoricalCsv(csv: string) {
  const all = await listGolfers();
  const find = (key: string) =>
    all.find((g) => g.email?.toLowerCase() === key.toLowerCase() || g.name.toLowerCase() === key.toLowerCase());
  const rows: { golferId: number; playedOn: string; gross: number }[] = [];
  const errors: string[] = [];
  for (const [i, raw] of csv.split(/\r?\n/).entries()) {
    const line = raw.trim();
    if (!line) continue;
    const [who, date, gross] = line.split(/[,\t]/).map((s) => s.trim());
    if (i === 0 && isNaN(Number(gross))) continue; // header row
    if (!who || !/^\d{4}-\d{2}-\d{2}$/.test(date ?? "") || !Number.isInteger(Number(gross))) {
      errors.push(`Line ${i + 1}: expected "name, YYYY-MM-DD, gross" but got "${line}"`);
      continue;
    }
    let g = find(who);
    if (!g) {
      g = await createGolfer(who.includes("@") ? { name: who.split("@")[0], email: who } : { name: who });
      all.push(g);
    }
    rows.push({ golferId: g.id, playedOn: date, gross: Number(gross) });
  }
  const inserted = await addHistoricalRounds(rows);
  return { imported: inserted.length, errors };
}

// ---------- seasons ----------

export interface SeasonInput {
  name: string;
  year: number;
  startDate: string;
  status?: "upcoming" | "active" | "completed";
  handicapPercent?: number;
  provisionalPercent?: number;
  rollingRounds?: number;
  establishRounds?: number;
}

export async function createSeason(input: SeasonInput) {
  const courseId = await ensureDefaultCourse();
  const [s] = await db.insert(seasons).values({ ...input, courseId }).returning();
  if (s.status === "active") await deactivateOthers(s.id);
  return s;
}

export async function updateSeason(id: number, input: Partial<SeasonInput>) {
  const [s] = await db.update(seasons).set(input).where(eq(seasons.id, id)).returning();
  if (!s) throw notFound("Season not found");
  if (input.status === "active") await deactivateOthers(id);
  return s;
}

async function deactivateOthers(activeId: number) {
  await db
    .update(seasons)
    .set({ status: "completed" })
    .where(and(eq(seasons.status, "active"), sql`${seasons.id} <> ${activeId}`));
}

export async function setSeasonPlayers(seasonId: number, golferIds: number[]) {
  const unique = [...new Set(golferIds)];
  const current = await db.select().from(seasonPlayers).where(eq(seasonPlayers.seasonId, seasonId));
  const remove = current.filter((c) => !unique.includes(c.golferId)).map((c) => c.golferId);
  const add = unique.filter((id) => !current.some((c) => c.golferId === id));
  if (remove.length)
    await db
      .delete(seasonPlayers)
      .where(and(eq(seasonPlayers.seasonId, seasonId), inArray(seasonPlayers.golferId, remove)));
  if (add.length) await db.insert(seasonPlayers).values(add.map((golferId) => ({ seasonId, golferId })));
  return unique;
}

// ---------- schedule ----------

async function seasonHasScores(seasonId: number) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(matchEntries)
    .innerJoin(matches, eq(matchEntries.matchId, matches.id))
    .innerJoin(weeks, eq(matches.weekId, weeks.id))
    .where(eq(weeks.seasonId, seasonId));
  return row.n > 0;
}

/**
 * Build a full season: a round robin where everyone plays everyone once, then a
 * position night. Replaces any existing schedule (only allowed before scores exist).
 */
export async function generateSchedule(seasonId: number, opts: { startDate?: string; positionNight?: boolean } = {}) {
  const [season] = await db.select().from(seasons).where(eq(seasons.id, seasonId));
  if (!season) throw notFound("Season not found");
  if (await seasonHasScores(seasonId)) throw conflict("Scores have been entered; edit weeks individually instead.");
  const players = await db.select().from(seasonPlayers).where(eq(seasonPlayers.seasonId, seasonId));
  if (players.length < 2) throw badRequest("Add at least two players to the season first.");

  const start = opts.startDate ?? season.startDate;
  const rounds = roundRobin(shuffle(players.map((p) => p.golferId)));
  const includePosition = opts.positionNight ?? true;

  await db.transaction(async (tx) => {
    await tx.delete(weeks).where(eq(weeks.seasonId, seasonId));
    for (const [i, round] of rounds.entries()) {
      const [w] = await tx
        .insert(weeks)
        .values({ seasonId, number: i + 1, date: addDays(start, 7 * i), kind: "regular" })
        .returning();
      await tx.insert(matches).values(round.map(([a, b]) => ({ weekId: w.id, golferAId: a, golferBId: b })));
    }
    if (includePosition) {
      await tx.insert(weeks).values({
        seasonId,
        number: rounds.length + 1,
        date: addDays(start, 7 * rounds.length),
        kind: "position",
        notes: "Position night: 1 v 2, 3 v 4, …",
      });
    }
    if (opts.startDate) await tx.update(seasons).set({ startDate: start }).where(eq(seasons.id, seasonId));
  });
  return loadSeason(seasonId);
}

/** Fill the position-night week from standings of all regular weeks. */
export async function generatePositionNight(seasonId: number, weekId?: number) {
  const data = await loadSeason(seasonId);
  const week = weekId ? data.weeks.find((w) => w.id === weekId) : data.weeks.find((w) => w.kind === "position");
  if (!week) throw notFound("No position night week in this season");
  if (week.matches.some((m) => m.a.entryId || m.b?.entryId)) throw conflict("Scores already entered for position night");
  const regular = data.weeks.filter((w) => w.kind === "regular");
  const incomplete = regular.filter((w) => !w.complete).map((w) => w.number);
  const pairs = positionNight(data.standings.map((s) => s.golfer.id));
  await db.transaction(async (tx) => {
    await tx.delete(matches).where(eq(matches.weekId, week.id));
    await tx.update(weeks).set({ kind: "position" }).where(eq(weeks.id, week.id));
    await tx.insert(matches).values(pairs.map(([a, b]) => ({ weekId: week.id, golferAId: a, golferBId: b })));
  });
  return { weekId: week.id, pairs, incompleteWeeks: incomplete };
}

export interface WeekInput {
  date?: string;
  kind?: "regular" | "position";
  notes?: string | null;
}

export async function createWeek(seasonId: number, input: WeekInput) {
  const existing = await db.select().from(weeks).where(eq(weeks.seasonId, seasonId)).orderBy(asc(weeks.number));
  const last = existing.at(-1);
  const [w] = await db
    .insert(weeks)
    .values({
      seasonId,
      number: (last?.number ?? 0) + 1,
      date: input.date ?? (last ? addDays(last.date, 7) : new Date().toISOString().slice(0, 10)),
      kind: input.kind ?? "regular",
      notes: input.notes ?? null,
    })
    .returning();
  return w;
}

export async function updateWeek(weekId: number, input: WeekInput) {
  const [w] = await db.update(weeks).set(input).where(eq(weeks.id, weekId)).returning();
  if (!w) throw notFound("Week not found");
  return w;
}

export async function deleteWeek(weekId: number) {
  const [w] = await db.delete(weeks).where(eq(weeks.id, weekId)).returning();
  if (!w) throw notFound("Week not found");
  // keep numbering contiguous
  await db
    .update(weeks)
    .set({ number: sql`${weeks.number} - 1` })
    .where(and(eq(weeks.seasonId, w.seasonId), gt(weeks.number, w.number)));
}

/** Rainout: push this week and every later week back by `days` (default one week). */
export async function postponeWeek(weekId: number, reason?: string, days = 7) {
  const [w] = await db.select().from(weeks).where(eq(weeks.id, weekId));
  if (!w) throw notFound("Week not found");
  await db.transaction(async (tx) => {
    await tx
      .update(weeks)
      .set({ date: sql`${weeks.date} + ${days}::int` })
      .where(and(eq(weeks.seasonId, w.seasonId), gte(weeks.number, w.number)));
    await tx
      .update(weeks)
      .set({
        postponements: w.postponements + 1,
        notes: [w.notes, `Postponed from ${w.date}${reason ? ` (${reason})` : ""}`].filter(Boolean).join(" · "),
      })
      .where(eq(weeks.id, weekId));
  });
  const [updated] = await db.select().from(weeks).where(eq(weeks.id, weekId));
  return updated;
}

// ---------- matches ----------

export async function createMatch(weekId: number, golferAId: number, golferBId: number | null) {
  if (golferAId === golferBId) throw badRequest("A golfer can't play themselves");
  const [m] = await db.insert(matches).values({ weekId, golferAId, golferBId }).returning();
  return m;
}

export async function updateMatch(matchId: number, golferAId: number, golferBId: number | null) {
  if (golferAId === golferBId) throw badRequest("A golfer can't play themselves");
  const [m] = await db.update(matches).set({ golferAId, golferBId }).where(eq(matches.id, matchId)).returning();
  if (!m) throw notFound("Match not found");
  return m;
}

export async function deleteMatch(matchId: number) {
  await db.delete(matches).where(eq(matches.id, matchId));
}
