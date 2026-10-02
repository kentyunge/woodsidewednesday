import { z } from "@hono/zod-openapi";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { golfers, historicalRounds, holes, matchEntries, matches, seasonPlayers, seasons, weeks } from "@/db/schema";
import { ensureDefaultCourse } from "./bootstrap";
import { badRequest } from "./errors";

const DateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const Side = z
  .object({
    /** The scheduled golfer's email. */
    golfer: z.string(),
    /** Name of the sub who played instead, if any. */
    sub: z.string().nullish(),
    /** One gross score per hole. */
    scores: z.array(z.number().int().min(1).max(20)),
  })
  .openapi("SeasonImportSide");

/** A finished season from outside the app (e.g. the old Google Sheet), loaded in one go. */
export const SeasonImport = z
  .object({
    season: z.object({
      name: z.string().min(1),
      year: z.number().int(),
      startDate: DateStr,
      status: z.enum(["upcoming", "active", "completed"]).default("completed"),
      handicapPercent: z.number().min(0).max(1).optional(),
      provisionalPercent: z.number().min(0).max(1).optional(),
      rollingRounds: z.number().int().min(1).optional(),
      establishRounds: z.number().int().min(0).optional(),
    }),
    /** The season's regulars, matched to existing golfers by email. */
    players: z.array(z.object({ email: z.string(), name: z.string().optional() })).min(2),
    /** Rounds from before the season that seed handicaps (stored as carried-over rounds). */
    previousRounds: z.array(z.object({ email: z.string(), playedOn: DateStr, gross: z.number().int().min(9).max(99) })).default([]),
    weeks: z
      .array(
        z.object({
          number: z.number().int().min(1),
          date: DateStr,
          kind: z.enum(["regular", "position"]).default("regular"),
          /** Mark the week complete (no recap email is sent). */
          complete: z.boolean().default(true),
          matches: z.array(z.object({ a: Side, b: Side })),
        }),
      )
      .min(1),
  })
  .openapi("SeasonImport");

export type SeasonImport = z.input<typeof SeasonImport>;

export interface SeasonImportResult {
  dryRun: boolean;
  seasonId: number | null;
  seasonName: string;
  players: string[];
  previousRounds: number;
  weeks: number;
  matches: number;
  cards: number;
  newSubs: string[];
  existingSubs: string[];
}

const key = (s: string) => s.trim().toLowerCase();

/**
 * Check the whole file first and report every problem at once; then write it all in one
 * transaction, so a failed import leaves nothing behind. With `dryRun` nothing is written.
 */
export async function importSeason(raw: unknown, { dryRun = false } = {}): Promise<SeasonImportResult> {
  const parsed = SeasonImport.safeParse(raw);
  if (!parsed.success) {
    throw badRequest(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  }
  const input = parsed.data;
  const courseId = await ensureDefaultCourse();
  const [all, holeRows, sameName] = await Promise.all([
    db.select().from(golfers),
    db.select({ id: holes.id }).from(holes).where(eq(holes.courseId, courseId)),
    db.select({ id: seasons.id }).from(seasons).where(sql`lower(${seasons.name}) = ${key(input.season.name)}`),
  ]);
  const holeCount = holeRows.length;
  const problems: string[] = [];
  if (sameName.length) problems.push(`A season named "${input.season.name}" already exists`);

  const byEmail = new Map(all.filter((g) => g.email).map((g) => [key(g.email!), g]));
  const regulars = new Map<string, (typeof all)[number]>();
  for (const p of input.players) {
    const g = byEmail.get(key(p.email));
    if (!g) problems.push(`No golfer has the email ${p.email}${p.name ? ` (${p.name})` : ""}`);
    else regulars.set(key(p.email), g);
  }
  const isRegular = (email: string) => regulars.has(key(email));
  // Golfers named in rounds or matches but missing from `players`, reported once each.
  const strangers = new Map<string, number>();
  const stranger = (email: string) => strangers.set(key(email), (strangers.get(key(email)) ?? 0) + 1);
  for (const r of input.previousRounds) {
    if (!isRegular(r.email)) stranger(r.email);
    if (r.playedOn >= input.season.startDate) problems.push(`Previous round for ${r.email} on ${r.playedOn} isn't before the season starts`);
  }

  // Subs are matched to existing golfers by name, otherwise created.
  const subNames = new Map<string, string>();
  const numbers = new Set<number>();
  let cards = 0;
  for (const w of input.weeks) {
    if (numbers.has(w.number)) problems.push(`Week ${w.number} appears twice`);
    numbers.add(w.number);
    const seen = new Set<string>();
    w.matches.forEach((m, i) => {
      for (const s of [m.a, m.b]) {
        const where = `Week ${w.number} match ${i + 1}`;
        if (!isRegular(s.golfer)) stranger(s.golfer);
        if (seen.has(key(s.golfer))) problems.push(`${where}: ${s.golfer} is in two matches`);
        seen.add(key(s.golfer));
        if (s.scores.length !== holeCount) problems.push(`${where}: ${s.golfer} has ${s.scores.length} hole scores, expected ${holeCount}`);
        if (s.sub?.trim()) subNames.set(key(s.sub), s.sub.trim());
        cards++;
      }
      if (key(m.a.golfer) === key(m.b.golfer)) problems.push(`Week ${w.number} match ${i + 1}: a golfer can't play themselves`);
    });
  }
  for (const [email, n] of strangers) {
    if (input.players.some((p) => key(p.email) === email)) continue; // already reported as unknown
    problems.push(`${email} appears ${n} time${n === 1 ? "" : "s"} but isn't in the players list`);
  }
  const byName = new Map(all.map((g) => [key(g.name), g]));
  for (const [k, name] of subNames) {
    const g = byName.get(k);
    if (g && regulars.has(key(g.email ?? ""))) problems.push(`Sub "${name}" has the same name as one of the season's players`);
  }
  if (problems.length) throw badRequest([...new Set(problems)].join("; "));

  const existingSubs = [...subNames.keys()].filter((k) => byName.has(k)).map((k) => byName.get(k)!.name);
  const newSubs = [...subNames].filter(([k]) => !byName.has(k)).map(([, n]) => n);
  const summary: SeasonImportResult = {
    dryRun,
    seasonId: null,
    seasonName: input.season.name,
    players: [...regulars.values()].map((g) => g.name),
    previousRounds: input.previousRounds.length,
    weeks: input.weeks.length,
    matches: input.weeks.reduce((n, w) => n + w.matches.length, 0),
    cards,
    newSubs,
    existingSubs,
  };
  if (dryRun) return summary;

  return db.transaction(async (tx) => {
    const [season] = await tx
      .insert(seasons)
      .values({ ...input.season, courseId })
      .returning();
    if (season.status === "active") {
      await tx
        .update(seasons)
        .set({ status: "completed" })
        .where(sql`${seasons.status} = 'active' and ${seasons.id} <> ${season.id}`);
    }
    await tx.insert(seasonPlayers).values([...regulars.values()].map((g) => ({ seasonId: season.id, golferId: g.id })));
    if (input.previousRounds.length) {
      await tx.insert(historicalRounds).values(
        input.previousRounds.map((r) => ({
          golferId: regulars.get(key(r.email))!.id,
          playedOn: r.playedOn,
          gross: r.gross,
          note: `Before ${input.season.name}`,
        })),
      );
    }

    const subIds = new Map<string, number>();
    for (const [k, name] of subNames) {
      const existing = byName.get(k);
      if (existing) subIds.set(k, existing.id);
      else {
        const [g] = await tx.insert(golfers).values({ name, isSub: true }).returning({ id: golfers.id });
        subIds.set(k, g.id);
      }
    }

    for (const w of input.weeks) {
      const [week] = await tx
        .insert(weeks)
        .values({ seasonId: season.id, number: w.number, date: w.date, kind: w.kind, closedAt: w.complete ? new Date() : null })
        .returning({ id: weeks.id });
      for (const m of w.matches) {
        const [match] = await tx
          .insert(matches)
          .values({ weekId: week.id, golferAId: regulars.get(key(m.a.golfer))!.id, golferBId: regulars.get(key(m.b.golfer))!.id })
          .returning({ id: matches.id });
        await tx.insert(matchEntries).values(
          (["A", "B"] as const).map((side) => {
            const s = side === "A" ? m.a : m.b;
            const sub = s.sub?.trim();
            return {
              matchId: match.id,
              side,
              status: sub ? ("sub" as const) : ("played" as const),
              playerId: sub ? subIds.get(key(sub))! : null,
              scores: s.scores,
            };
          }),
        );
      }
    }
    return { ...summary, seasonId: season.id };
  });
}
