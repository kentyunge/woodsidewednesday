import { listGolfers, listHistoricalRounds } from "@/server/admin";
import { upcomingHandicap } from "@/server/league";
import { resolveSeason } from "@/server/session";
import { HandicapsAdmin } from "./handicaps-admin";

export const metadata = { title: "Handicaps" };

export default async function HandicapsAdminPage({ searchParams }: PageProps<"/admin/handicaps">) {
  const { data } = await resolveSeason((await searchParams).season);
  const [golfers, rounds] = await Promise.all([listGolfers(), listHistoricalRounds()]);
  return (
    <HandicapsAdmin
      golfers={golfers
        .filter((g) => g.active)
        .map((g) => {
          const h = data ? upcomingHandicap(data, g.id) : null;
          return { id: g.id, name: g.name, isSub: g.isSub, handicap: h?.handicap ?? null, method: h?.method ?? "pending", basis: h?.basis ?? [] };
        })}
      rounds={rounds.map((r) => ({ id: r.id, golferId: r.golferId, playedOn: r.playedOn, gross: r.gross, note: r.note }))}
    />
  );
}
