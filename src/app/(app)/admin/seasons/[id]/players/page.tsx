import { eq } from "drizzle-orm";
import { db } from "@/db";
import { seasonPlayers } from "@/db/schema";
import { listGolfers } from "@/server/admin";
import { SeasonPlayers } from "./season-players";

export const metadata = { title: "Season players" };

export default async function SeasonPlayersPage({ params }: PageProps<"/admin/seasons/[id]/players">) {
  const id = Number((await params).id);
  const [golfers, current] = await Promise.all([
    listGolfers(),
    db.select({ golferId: seasonPlayers.golferId }).from(seasonPlayers).where(eq(seasonPlayers.seasonId, id)),
  ]);
  return (
    <SeasonPlayers
      seasonId={id}
      playerIds={current.map((p) => p.golferId)}
      golfers={golfers.map((g) => ({ id: g.id, name: g.name, active: g.active }))}
    />
  );
}
