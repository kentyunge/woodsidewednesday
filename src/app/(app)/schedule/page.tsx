import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MatchRow } from "@/components/league/match-row";
import { SeasonPicker } from "@/components/league/season-picker";
import { formatDate, today } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { requirePageActor, resolveSeason } from "@/server/session";

export const metadata = { title: "Schedule" };

export default async function SchedulePage({ searchParams }: PageProps<"/schedule">) {
  const actor = await requirePageActor();
  const { seasons, season, data } = await resolveSeason((await searchParams).season);
  if (!season || !data) return <p className="text-muted-foreground">No season yet.</p>;
  const t = today();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Schedule</h1>
          <p className="text-muted-foreground text-sm">{season.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <SeasonPicker seasons={seasons} value={season.id} />
          {actor.isAdmin && (
            <Button variant="outline" asChild>
              <Link href={`/admin/schedule?season=${season.id}`}>Manage</Link>
            </Button>
          )}
        </div>
      </div>
      {data.weeks.length === 0 && <p className="text-muted-foreground">No weeks scheduled yet.</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {data.weeks.map((w) => {
          const open = w.date <= t && t < w.lockDate;
          return (
            <Card key={w.id} className={cn("gap-3", open && "border-primary/50 ring-primary/20 ring-2")}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Week {w.number}
                  {w.kind === "position" && <Badge>Position night</Badge>}
                </CardTitle>
                <CardDescription>
                  {formatDate(w.date, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                  {w.notes && <span className="block">{w.notes}</span>}
                </CardDescription>
                <CardAction className="flex gap-1">
                  {w.postponements > 0 && <Badge variant="outline">Postponed</Badge>}
                  {w.complete ? (
                    <Badge variant="secondary">Final</Badge>
                  ) : open ? (
                    <Badge>Scores open</Badge>
                  ) : null}
                </CardAction>
              </CardHeader>
              <CardContent className="px-0">
                {w.matches.length === 0 ? (
                  <p className="text-muted-foreground px-6 text-sm">
                    {w.kind === "position" ? "Pairings set from final standings: 1 v 2, 3 v 4, …" : "No matches"}
                  </p>
                ) : (
                  <div className="divide-y border-y">
                    {w.matches.map((m) => (
                      <MatchRow key={m.id} match={m} highlight={actor.golferId} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
