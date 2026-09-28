import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Distribution } from "@/components/league/distribution";
import { MatchRow } from "@/components/league/match-row";
import { SeasonPicker } from "@/components/league/season-picker";
import { StandingsTable } from "@/components/league/standings-table";
import { StatTile } from "@/components/league/stat-tile";
import { formatDate } from "@/lib/dates";
import { fmt, cn } from "@/lib/utils";
import { requirePageActor, resolveSeason } from "@/server/session";
import { leagueStats, type Leader } from "@/server/stats";
import { featuredWeek } from "@/server/league";

export const metadata = { title: "League" };

function LeaderList({ title, rows, unit, digits = 0 }: { title: string; rows: Leader[]; unit?: string; digits?: number }) {
  return (
    <div>
      <div className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">{title}</div>
      {rows.length === 0 && <div className="text-muted-foreground text-sm">No rounds yet</div>}
      <ol className="space-y-1 text-sm">
        {rows.map((r, i) => (
          <li key={r.golfer.id} className="flex justify-between gap-2">
            <span className="truncate">
              <span className="text-muted-foreground mr-1.5 tabular-nums">{i + 1}.</span>
              {r.golfer.name}
            </span>
            <span className="font-medium tabular-nums">
              {digits ? r.value.toFixed(digits) : r.value}
              {unit}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default async function LeaguePage({ searchParams }: PageProps<"/">) {
  const actor = await requirePageActor();
  const { season: seasonParam } = await searchParams;
  const { seasons, season, data } = await resolveSeason(seasonParam);

  if (!season || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Welcome to Woodside Wednesday</CardTitle>
          <CardDescription>No season has been set up yet.</CardDescription>
        </CardHeader>
        {actor.isAdmin && (
          <CardContent>
            <Button asChild>
              <Link href="/admin">Set up the first season</Link>
            </Button>
          </CardContent>
        )}
      </Card>
    );
  }

  const stats = leagueStats(data);
  const week = featuredWeek(data.weeks);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{season.name}</h1>
          <p className="text-muted-foreground text-sm">
            {data.players.length} golfers · {data.weeks.length} weeks · par {data.par}
          </p>
        </div>
        <SeasonPicker seasons={seasons} value={season.id} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Rounds played" value={stats.roundsPlayed} sub={`${data.weeks.filter((w) => w.complete).length} weeks complete`} />
        <StatTile label="League avg" value={fmt(stats.avgGross)} sub="gross per round" />
        <StatTile
          label="Low gross"
          value={stats.lowGross?.value ?? "–"}
          sub={stats.lowGross ? `${stats.lowGross.golfer.name} · ${stats.lowGross.detail}` : undefined}
        />
        <StatTile
          label="Low net"
          value={stats.lowNet?.value ?? "–"}
          sub={stats.lowNet ? `${stats.lowNet.golfer.name} · ${stats.lowNet.detail}` : undefined}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="gap-3 lg:col-span-3">
          <CardHeader>
            <CardTitle>Standings</CardTitle>
            <CardDescription>20 points per match · ties broken by random draw</CardDescription>
          </CardHeader>
          <CardContent className="px-2 sm:px-4">
            <StandingsTable rows={data.standings} highlight={actor.golferId} seasonId={season.id} />
          </CardContent>
        </Card>

        <Card className="gap-3 lg:col-span-2">
          <CardHeader>
            <CardTitle>
              {week ? `Week ${week.number}` : "Schedule"}
              {week?.kind === "position" && <span className="text-primary ml-2 text-sm">Position night</span>}
            </CardTitle>
            <CardDescription>
              {week ? formatDate(week.date, { weekday: "long", month: "long", day: "numeric" }) : "No weeks scheduled"}
              {week?.notes && <span className="block">{week.notes}</span>}
            </CardDescription>
            <CardAction>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/schedule?season=${season.id}`}>Full schedule</Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="px-0">
            {week && week.matches.length === 0 && (
              <p className="text-muted-foreground px-6 text-sm">
                {week.kind === "position" ? "Pairings are set after the last regular week." : "No matches yet."}
              </p>
            )}
            <div className="divide-y border-y">
              {week?.matches.map((m) => <MatchRow key={m.id} match={m} highlight={actor.golferId} />)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="gap-3">
          <CardHeader>
            <CardTitle>Scoring</CardTitle>
            <CardDescription>Every hole played this season</CardDescription>
          </CardHeader>
          <CardContent>
            <Distribution data={stats.distribution} />
          </CardContent>
        </Card>

        <Card className="gap-3">
          <CardHeader>
            <CardTitle>Leaders</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <LeaderList title="Birdies" rows={stats.leaders.birdies} />
            <LeaderList title="Scoring average" rows={stats.leaders.scoringAvg} digits={1} />
            <LeaderList title="Pars" rows={stats.leaders.pars} />
          </CardContent>
        </Card>

        <Card className="gap-3">
          <CardHeader>
            <CardTitle>Hole difficulty</CardTitle>
            <CardDescription>Average score vs par, hardest first</CardDescription>
          </CardHeader>
          <CardContent className="px-2 sm:px-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hole</TableHead>
                  <TableHead className="text-right">Par</TableHead>
                  <TableHead className="text-right">Hdcp</TableHead>
                  <TableHead className="text-right">Avg</TableHead>
                  <TableHead className="text-right">+/-</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...stats.holeDifficulty]
                  .sort((a, b) => (b.overPar ?? -99) - (a.overPar ?? -99))
                  .map((h) => (
                    <TableRow key={h.hole}>
                      <TableCell>#{h.hole}</TableCell>
                      <TableCell className="text-right tabular-nums">{h.par}</TableCell>
                      <TableCell className="text-right tabular-nums">{h.handicap}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(h.avg, 2)}</TableCell>
                      <TableCell className={cn("text-right font-medium tabular-nums")}>
                        {h.overPar === null ? "–" : `${h.overPar >= 0 ? "+" : ""}${h.overPar.toFixed(2)}`}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {stats.weeklyLows.length > 0 && (
        <Card className="gap-3">
          <CardHeader>
            <CardTitle>Weekly low scores</CardTitle>
          </CardHeader>
          <CardContent className="px-2 sm:px-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Week</TableHead>
                  <TableHead>Low gross</TableHead>
                  <TableHead>Low net</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.weeklyLows.map((w) => (
                  <TableRow key={w.weekNumber}>
                    <TableCell>
                      {w.weekNumber} <span className="text-muted-foreground text-xs">{formatDate(w.date)}</span>
                    </TableCell>
                    <TableCell>
                      {w.gross ? (
                        <>
                          <span className="font-medium tabular-nums">{w.gross.value}</span> {w.gross.golfer.name}
                        </>
                      ) : (
                        "–"
                      )}
                    </TableCell>
                    <TableCell>
                      {w.net ? (
                        <>
                          <span className="font-medium tabular-nums">{w.net.value}</span> {w.net.golfer.name}
                        </>
                      ) : (
                        "–"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
