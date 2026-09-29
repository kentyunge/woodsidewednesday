import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GolferDashboard } from "@/components/league/golfer-dashboard";
import { requirePageActor, resolveSeason } from "@/server/session";

export const metadata = { title: "My Stats" };

export default async function MePage({ searchParams }: PageProps<"/me">) {
  const actor = await requirePageActor();
  const { seasons, data } = await resolveSeason((await searchParams).season);
  if (actor.golferId === null || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No golfer profile linked</CardTitle>
          <CardDescription>
            Your login ({actor.email}) isn&apos;t linked to a golfer yet. The league admin can add your email to your golfer record.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }
  return <GolferDashboard data={data} seasons={seasons} golferId={actor.golferId} isSelf />;
}
