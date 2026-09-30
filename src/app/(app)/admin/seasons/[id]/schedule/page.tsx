import { fmt } from "@/lib/utils";
import { loadSeason } from "@/server/league";
import { listRecaps, recapRecipients } from "@/server/recap";
import { ScheduleAdmin } from "./schedule-admin";

export const metadata = { title: "Manage schedule" };

export default async function SeasonScheduleAdminPage({ params }: PageProps<"/admin/seasons/[id]/schedule">) {
  const data = await loadSeason(Number((await params).id));
  const { season } = data;
  const [recaps, recipients] = await Promise.all([
    listRecaps({ weekIds: data.weeks.map((w) => w.id) }),
    recapRecipients(season.id),
  ]);
  const hasScores = data.matches.some((m) => m.a.entryId || m.b?.entryId);
  const golferIds = new Set([...data.players.map((p) => p.id), ...data.matches.flatMap((m) => [m.a.owner.id, m.b?.owner.id ?? 0])]);
  return (
    <ScheduleAdmin
      season={{ id: season.id, name: season.name, startDate: season.startDate }}
      players={[...data.golfers.values()].filter((g) => golferIds.has(g.id)).map((g) => ({ id: g.id, name: g.name }))}
      playerCount={data.players.length}
      hasScores={hasScores}
      recipients={
        recipients.to.length
          ? `${recipients.mode === "admins" ? "admins only (test mode)" : "the whole league"}: ${recipients.to.join(", ")}`
          : "nobody yet: set ADMIN_EMAILS"
      }
      weeks={data.weeks.map((w) => ({
        id: w.id,
        number: w.number,
        date: w.date,
        kind: w.kind,
        notes: w.notes,
        postponements: w.postponements,
        complete: w.complete,
        closed: w.closed,
        incomplete: w.matches.filter((m) => !m.complete).length,
        recaps: recaps
          .filter((r) => r.weekId === w.id)
          .map((r) => ({ id: r.id, subject: r.subject, sentTo: r.sentTo, createdAt: r.createdAt.toISOString() })),
        matches: w.matches.map((m) => ({
          id: m.id,
          a: m.a.owner.id,
          b: m.b?.owner.id ?? null,
          hasScores: !!(m.a.entryId || m.b?.entryId),
          summary: !m.b
            ? `${m.a.owner.name}: bye`
            : m.complete
              ? `${m.a.owner.name} ${fmt(m.a.pointsAwarded)} – ${fmt(m.b.pointsAwarded)} ${m.b.owner.name}`
              : `${m.a.owner.name} vs ${m.b.owner.name} (no result yet)`,
        })),
      }))}
    />
  );
}
