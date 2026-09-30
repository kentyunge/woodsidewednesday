import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MatchRow } from "@/components/league/match-row";
import { SeasonPicker } from "@/components/league/season-picker";
import { formatDate, today } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { splitWeeks } from "@/lib/weeks";
import type { WeekView } from "@/server/league";
import { requirePageActor, resolveSeason } from "@/server/session";

export const metadata = { title: "Schedule" };

function WeekCard({ week, current, golferId }: { week: WeekView; current?: boolean; golferId: number | null }) {
  const t = today();
  const open = !week.closed && week.date <= t && t < week.lockDate;
  return (
    <Card className={cn("gap-3", current && "border-primary/50 ring-primary/20 ring-2")}>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Week {week.number}
          {current && <Badge>This week</Badge>}
          {week.kind === "position" && <Badge variant="outline">Position night</Badge>}
        </CardTitle>
        <CardDescription>
          {formatDate(week.date, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
          {week.notes && <span className="block">{week.notes}</span>}
        </CardDescription>
        <CardAction className="flex gap-1">
          {week.postponements > 0 && !week.closed && <Badge variant="outline">Postponed</Badge>}
          {week.closed ? <Badge variant="secondary">Final</Badge> : open ? <Badge>Scores open</Badge> : null}
        </CardAction>
      </CardHeader>
      <CardContent className="px-0">
        {week.matches.length === 0 ? (
          <p className="text-muted-foreground px-6 text-sm">
            {week.kind === "position" ? "Pairings set from final standings: 1 v 2, 3 v 4, …" : "No matches"}
          </p>
        ) : (
          <div className="divide-y border-y">
            {week.matches.map((m) => (
              <MatchRow key={m.id} match={m} highlight={golferId} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default async function SchedulePage({ searchParams }: PageProps<"/schedule">) {
  const actor = await requirePageActor();
  const { seasons, season, data } = await resolveSeason((await searchParams).season);
  if (!season || !data) return <p className="text-muted-foreground">No season yet.</p>;
  const { current, upcoming, completed } = splitWeeks(data.weeks);

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
              <Link href={`/admin/seasons/${season.id}/schedule`}>Manage</Link>
            </Button>
          )}
        </div>
      </div>
      {data.weeks.length === 0 ? (
        <p className="text-muted-foreground">No weeks scheduled yet.</p>
      ) : (
        <Tabs defaultValue={current ? "current" : "completed"}>
          <TabsList>
            <TabsTrigger value="current">This week &amp; upcoming</TabsTrigger>
            <TabsTrigger value="completed">Completed ({completed.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="current" className="space-y-4 pt-2">
            {current ? (
              <WeekCard week={current} current golferId={actor.golferId} />
            ) : (
              <p className="text-muted-foreground text-sm">Every week is complete. That&apos;s a wrap!</p>
            )}
            {upcoming.length > 0 && (
              <>
                <h2 className="text-muted-foreground pt-2 text-sm font-medium tracking-wide uppercase">Upcoming</h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {upcoming.map((w) => (
                    <WeekCard key={w.id} week={w} golferId={actor.golferId} />
                  ))}
                </div>
              </>
            )}
          </TabsContent>
          <TabsContent value="completed" className="pt-2">
            {completed.length === 0 ? (
              <p className="text-muted-foreground text-sm">No completed weeks yet.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {completed.map((w) => (
                  <WeekCard key={w.id} week={w} golferId={actor.golferId} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
