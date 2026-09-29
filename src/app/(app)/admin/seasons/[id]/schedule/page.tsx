import { loadSeason } from "@/server/league";
import { ScheduleAdmin } from "./schedule-admin";

export const metadata = { title: "Manage schedule" };

export default async function SeasonScheduleAdminPage({ params }: PageProps<"/admin/seasons/[id]/schedule">) {
  const data = await loadSeason(Number((await params).id));
  const { season } = data;
  const hasScores = data.matches.some((m) => m.a.entryId || m.b?.entryId);
  const golferIds = new Set([...data.players.map((p) => p.id), ...data.matches.flatMap((m) => [m.a.owner.id, m.b?.owner.id ?? 0])]);
  return (
    <ScheduleAdmin
      season={{ id: season.id, name: season.name, startDate: season.startDate }}
      players={[...data.golfers.values()].filter((g) => golferIds.has(g.id)).map((g) => ({ id: g.id, name: g.name }))}
      playerCount={data.players.length}
      hasScores={hasScores}
      weeks={data.weeks.map((w) => ({
        id: w.id,
        number: w.number,
        date: w.date,
        kind: w.kind,
        notes: w.notes,
        postponements: w.postponements,
        complete: w.complete,
        matches: w.matches.map((m) => ({
          id: m.id,
          a: m.a.owner.id,
          b: m.b?.owner.id ?? null,
          hasScores: !!(m.a.entryId || m.b?.entryId),
        })),
      }))}
    />
  );
}
