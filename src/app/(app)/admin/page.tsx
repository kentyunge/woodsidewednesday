import { listGolfers } from "@/server/admin";
import { resolveSeason } from "@/server/session";
import { SeasonsAdmin } from "./seasons-admin";

export const metadata = { title: "Admin" };

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  const { seasons, season, data } = await resolveSeason((await searchParams).season);
  const golfers = await listGolfers();
  return (
    <SeasonsAdmin
      seasons={seasons}
      selected={season}
      playerIds={data?.players.map((p) => p.id) ?? []}
      golfers={golfers.map((g) => ({ id: g.id, name: g.name, active: g.active }))}
    />
  );
}
