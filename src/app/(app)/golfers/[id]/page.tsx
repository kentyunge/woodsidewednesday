import { notFound } from "next/navigation";
import { GolferDashboard } from "@/components/league/golfer-dashboard";
import { requirePageActor, resolveSeason } from "@/server/session";

export default async function GolferPage({ params, searchParams }: PageProps<"/golfers/[id]">) {
  const actor = await requirePageActor();
  const id = Number((await params).id);
  const { seasons, data } = await resolveSeason((await searchParams).season);
  if (!data || !data.golfers.has(id)) notFound();
  return <GolferDashboard data={data} seasons={seasons} golferId={id} isSelf={actor.golferId === id} />;
}
