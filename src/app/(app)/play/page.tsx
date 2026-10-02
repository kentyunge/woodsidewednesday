import { redirect } from "next/navigation";
import { today } from "@/lib/dates";
import { resolveSeason, requirePageActor } from "@/server/session";

/** Shortcut to tonight's card: the signed-in golfer's open match (as a regular or a sub). */
export default async function PlayShortcut() {
  const actor = await requirePageActor();
  const { data } = await resolveSeason();
  const t = today();
  const mine = (data?.matches ?? []).filter(
    (m) =>
      !m.bye &&
      [m.a, m.b].some((s) => s && (s.owner.id === actor.golferId || s.player?.id === actor.golferId)),
  );
  const open = mine.filter((m) => {
    const week = data!.weeks.find((w) => w.id === m.weekId)!;
    return m.date <= t && week.lockDate > t && !week.closed;
  });
  const match = open.at(-1);
  redirect(match ? `/matches/${match.id}/play` : "/schedule");
}
