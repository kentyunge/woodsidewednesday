import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { matchEntries, matches, weeks } from "@/db/schema";
import { today } from "@/lib/dates";
import { isComplete } from "@/lib/scoring";
import type { Actor } from "./access";
import { createGolfer } from "./admin";
import { badRequest, forbidden, notFound, unauthorized } from "./errors";
import { loadSeason, type MatchView, type SeasonData, type WeekView } from "./league";

export async function seasonIdForMatch(matchId: number): Promise<number> {
  const [row] = await db
    .select({ seasonId: weeks.seasonId })
    .from(matches)
    .innerJoin(weeks, eq(matches.weekId, weeks.id))
    .where(eq(matches.id, matchId));
  if (!row) throw notFound("Match not found");
  return row.seasonId;
}

export async function getMatch(matchId: number) {
  const data = await loadSeason(await seasonIdForMatch(matchId));
  const match = data.matches.find((m) => m.id === matchId)!;
  const week = data.weeks.find((w) => w.id === match.weekId)!;
  return { data, match, week };
}

export type EditAccess = { allowed: true; admin: boolean } | { allowed: false; reason: string };

/**
 * Golfers in a match can enter both cards until the next week's date; the admin can always edit.
 * Latest save wins.
 */
export function editAccess(actor: Actor | null, match: MatchView, week: WeekView): EditAccess {
  if (!actor) return { allowed: false, reason: "Sign in to enter scores" };
  if (actor.isAdmin) return { allowed: true, admin: true };
  const inMatch = actor.golferId !== null && [match.a.owner.id, match.b?.owner.id].includes(actor.golferId);
  if (!inMatch) return { allowed: false, reason: "Only golfers in this match can enter scores" };
  if (today() >= week.lockDate) return { allowed: false, reason: `Scores locked on ${week.lockDate}; ask the admin` };
  return { allowed: true, admin: false };
}

export interface EntryInput {
  status: "played" | "sub" | "ghost";
  /** Sub golfer id (status "sub"). */
  playerId?: number | null;
  /** Create a new sub golfer by name instead of `playerId`. */
  newSubName?: string | null;
  /** Golfer whose card the ghost uses; omit to pick one at random. */
  ghostId?: number | null;
  scores?: (number | null)[] | null;
  /** Admin only. */
  handicapOverride?: number | null;
  playedOn?: string | null;
}

/** Candidates for a ghost: anyone with a complete card that week who isn't in this match. */
export function ghostCandidates(data: SeasonData, match: MatchView) {
  const excluded = new Set([match.a.owner.id, match.b?.owner.id, match.a.player?.id, match.b?.player?.id]);
  return data.matches
    .filter((m) => m.weekId === match.weekId)
    .flatMap((m) => [m.a, m.b])
    .filter((s) => s?.player && !excluded.has(s.player.id) && isComplete(s.scores, data.holes.length))
    .map((s) => s!.player!);
}

export async function saveEntry(actor: Actor | null, matchId: number, side: "A" | "B", input: EntryInput) {
  if (!actor) throw unauthorized();
  const { data, match, week } = await getMatch(matchId);
  const access = editAccess(actor, match, week);
  if (!access.allowed) throw forbidden(access.reason);
  if (side === "B" && !match.b) throw badRequest("This match is a bye");
  if (input.handicapOverride != null && !access.admin) throw forbidden("Only the admin can override handicaps");

  const holeCount = data.holes.length;
  let scores = input.scores ?? null;
  if (scores) {
    if (scores.length !== holeCount) throw badRequest(`Expected ${holeCount} hole scores`);
    if (scores.some((s) => s !== null && (!Number.isInteger(s) || s < 1 || s > 20)))
      throw badRequest("Hole scores must be whole numbers from 1 to 20");
    if (scores.every((s) => s === null)) scores = null;
  }

  let playerId: number | null = null;
  let ghostId: number | null = null;
  if (input.status === "sub") {
    if (input.newSubName?.trim()) playerId = (await createGolfer({ name: input.newSubName })).id;
    else playerId = input.playerId ?? null;
    if (!playerId) throw badRequest("Choose the sub who played");
    if (playerId === match.a.owner.id || playerId === match.b?.owner.id) throw badRequest("Sub can't be a golfer in this match");
  } else if (input.status === "ghost") {
    const candidates = ghostCandidates(data, match);
    if (input.ghostId) {
      if (!candidates.some((c) => c.id === input.ghostId)) throw badRequest("That golfer has no complete card this week");
      ghostId = input.ghostId;
    } else {
      if (!candidates.length) throw badRequest("Enter at least one other complete card this week before drawing a ghost");
      ghostId = candidates[Math.floor(Math.random() * candidates.length)].id;
    }
    scores = null; // a ghost uses someone else's card
  }

  const values = {
    status: input.status,
    playerId,
    ghostId,
    scores,
    playedOn: input.playedOn ?? null,
    updatedBy: actor.userId,
    ...(access.admin && input.handicapOverride !== undefined && { handicapOverride: input.handicapOverride }),
  };

  const [existing] = await db
    .select({ id: matchEntries.id })
    .from(matchEntries)
    .where(and(eq(matchEntries.matchId, matchId), eq(matchEntries.side, side)));
  if (existing) await db.update(matchEntries).set(values).where(eq(matchEntries.id, existing.id));
  else await db.insert(matchEntries).values({ matchId, side, ...values });

  return (await getMatch(matchId)).match;
}

export async function clearEntry(actor: Actor | null, matchId: number, side: "A" | "B") {
  const { match, week } = await getMatch(matchId);
  const access = editAccess(actor, match, week);
  if (!access.allowed) throw forbidden(access.reason);
  await db.delete(matchEntries).where(and(eq(matchEntries.matchId, matchId), eq(matchEntries.side, side)));
  return (await getMatch(matchId)).match;
}
