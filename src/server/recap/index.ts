import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { golfers, seasonPlayers, settings, weekRecaps, weeks } from "@/db/schema";
import { adminEmails } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import type { Actor } from "../access";
import { badRequest, notFound } from "../errors";
import { loadSeason } from "../league";
import { buildRecapFacts } from "./facts";
import { renderRecapEmail } from "./email";
import { DEFAULT_TONE, RecapWriterError, writeRecap } from "./writer";

const TONE_KEY = "recap.tone";

export async function getRecapTone(): Promise<{ tone: string; isDefault: boolean }> {
  const [row] = await db.select().from(settings).where(eq(settings.key, TONE_KEY));
  return row ? { tone: row.value, isDefault: false } : { tone: DEFAULT_TONE, isDefault: true };
}

/** Save the tone instructions; an empty value restores the default. */
export async function setRecapTone(tone: string) {
  if (!tone.trim()) {
    await db.delete(settings).where(eq(settings.key, TONE_KEY));
  } else {
    await db
      .insert(settings)
      .values({ key: TONE_KEY, value: tone })
      .onConflictDoUpdate({ target: settings.key, set: { value: tone } });
  }
  return getRecapTone();
}

/**
 * Who the recap goes to. RECAP_SEND_TO=league adds every regular with an email;
 * anything else (the default) sends to the league admins only, for testing the tone.
 */
export async function recapRecipients(seasonId: number): Promise<{ mode: "admins" | "league"; to: string[] }> {
  const admins = adminEmails();
  if (process.env.RECAP_SEND_TO !== "league") return { mode: "admins", to: admins };
  const rows = await db
    .select({ email: golfers.email })
    .from(seasonPlayers)
    .innerJoin(golfers, eq(seasonPlayers.golferId, golfers.id))
    .where(eq(seasonPlayers.seasonId, seasonId));
  const league = rows.map((r) => r.email?.toLowerCase()).filter((e): e is string => !!e);
  return { mode: "league", to: [...new Set([...admins, ...league])] };
}

async function weekRow(weekId: number) {
  const [w] = await db.select().from(weeks).where(eq(weeks.id, weekId));
  if (!w) throw notFound("Week not found");
  return w;
}

/** Write the recap with Claude, store it, and (unless previewing) email it. */
export async function createRecap(actor: Actor, weekId: number, opts: { send: boolean }) {
  const w = await weekRow(weekId);
  const data = await loadSeason(w.seasonId);
  const facts = buildRecapFacts(data, weekId);
  if (!facts.golfers.length) throw badRequest("No scores have been entered for this week yet.");

  const { tone } = await getRecapTone();
  let written;
  try {
    written = await writeRecap(facts, tone);
  } catch (e) {
    if (e instanceof RecapWriterError) throw badRequest(e.message);
    throw e;
  }
  const email = renderRecapEmail(written.narrative, facts, data.standings, process.env.BETTER_AUTH_URL ?? null);

  const sentTo: string[] = [];
  if (opts.send) {
    const { to } = await recapRecipients(w.seasonId);
    if (!to.length) throw badRequest("No recipients: set ADMIN_EMAILS (or RECAP_SEND_TO=league).");
    for (const address of to) {
      await sendEmail(address, email.subject, email.html, email.text);
      sentTo.push(address);
    }
  }

  const [recap] = await db
    .insert(weekRecaps)
    .values({ weekId, subject: email.subject, html: email.html, text: email.text, model: written.model, sentTo, createdBy: actor.userId })
    .returning();
  return recap;
}

export interface CompleteWeekResult {
  week: typeof weeks.$inferSelect;
  recap: typeof weekRecaps.$inferSelect | null;
  /** Set when the week closed but the recap couldn't be written or sent. */
  recapError: string | null;
}

/** Close the week (locking golfer edits) and, optionally, send the recap. */
export async function completeWeek(actor: Actor, weekId: number, opts: { sendRecap: boolean }): Promise<CompleteWeekResult> {
  await weekRow(weekId);
  const [week] = await db.update(weeks).set({ closedAt: new Date() }).where(eq(weeks.id, weekId)).returning();
  if (!opts.sendRecap) return { week, recap: null, recapError: null };
  try {
    return { week, recap: await createRecap(actor, weekId, { send: true }), recapError: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : "The recap couldn't be sent.";
    console.error("[recap]", e);
    return { week, recap: null, recapError: message };
  }
}

export async function reopenWeek(weekId: number) {
  await weekRow(weekId);
  const [week] = await db.update(weeks).set({ closedAt: null }).where(eq(weeks.id, weekId)).returning();
  return week;
}

export async function listRecaps(opts: { weekIds?: number[]; limit?: number } = {}) {
  const q = db
    .select({
      id: weekRecaps.id,
      weekId: weekRecaps.weekId,
      weekNumber: weeks.number,
      seasonId: weeks.seasonId,
      subject: weekRecaps.subject,
      model: weekRecaps.model,
      sentTo: weekRecaps.sentTo,
      createdAt: weekRecaps.createdAt,
    })
    .from(weekRecaps)
    .innerJoin(weeks, eq(weekRecaps.weekId, weeks.id));
  return (opts.weekIds?.length ? q.where(inArray(weekRecaps.weekId, opts.weekIds)) : q)
    .orderBy(desc(weekRecaps.createdAt))
    .limit(opts.limit ?? 50);
}

export async function getRecap(id: number) {
  const [r] = await db.select().from(weekRecaps).where(eq(weekRecaps.id, id));
  if (!r) throw notFound("Recap not found");
  return r;
}
