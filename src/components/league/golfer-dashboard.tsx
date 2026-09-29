import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, today } from "@/lib/dates";
import { fmt, cn } from "@/lib/utils";
import type { Season, SeasonData } from "@/server/league";
import { golferSeasonStats } from "@/server/stats";
import { Distribution } from "./distribution";
import { SeasonPicker } from "./season-picker";
import { StatTile } from "./stat-tile";

const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

export function GolferDashboard({
  data,
  seasons,
  golferId,
  isSelf,
}: {
  data: SeasonData;
  seasons: Season[];
  golferId: number;
  isSelf: boolean;
}) {
  const s = golferSeasonStats(data, golferId);
  const g = data.golfers.get(golferId);
  const t = today();
  const next = data.matches.find(
    (m) => !m.complete && [m.a.owner.id, m.b?.owner.id].includes(golferId) && data.weeks.find((w) => w.id === m.weekId)!.lockDate > t,
  );
  const opponent = next ? (next.a.owner.id === golferId ? next.b?.owner : next.a.owner) : null;
  const isRegular = data.players.some((p) => p.id === golferId);
  const decided = s.holesWon + s.holesHalved + s.holesLost;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{isSelf ? "My dashboard" : s.golfer.name}</h1>
          <p className="text-muted-foreground text-sm">
            {isSelf && `${s.golfer.name} · `}
            {data.season.name}
            {!isRegular && " · sub"}
            {!isSelf && g?.email && ` · ${g.email}`}
            {!isSelf && g?.phone && ` · ${g.phone}`}
          </p>
        </div>
        <SeasonPicker seasons={seasons} value={data.season.id} />
      </div>

      {next && (
        <Card className="border-primary/40 bg-primary/5 gap-2 py-4">
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                {next.date <= t ? "Scores open" : "Next match"} · Week {next.weekNumber}
                {next.kind === "position" && " · Position night"}
              </div>
              <div className="text-lg font-semibold">vs {opponent?.name ?? "Bye"}</div>
              <div className="text-muted-foreground text-sm">{formatDate(next.date, { weekday: "long", month: "long", day: "numeric" })}</div>
            </div>
            {!next.bye && (
              <Button asChild>
                <Link href={`/matches/${next.id}`}>{next.date <= t ? "Enter scores" : "View scorecard"}</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="Position"
          value={s.rank ? ordinal(s.rank) : "–"}
          sub={s.rank ? `of ${data.standings.length} · ${fmt(s.points)} pts` : "not a regular this season"}
        />
        <StatTile label="Record" value={`${s.wins}-${s.losses}-${s.ties}`} sub="W-L-T" />
        <StatTile
          label="Handicap"
          value={fmt(s.handicap)}
          sub={s.handicapMethod === "rolling" ? "90% of last 5 rounds" : "not yet established"}
        />
        <StatTile label="Avg gross" value={fmt(s.avgGross)} sub={`${s.rounds} round${s.rounds === 1 ? "" : "s"}`} />
        <StatTile label="Low gross" value={fmt(s.lowGross)} />
        <StatTile label="Avg net" value={fmt(s.avgNet)} sub={`low ${fmt(s.lowNet)}`} />
        <StatTile
          label="Holes won"
          value={s.holesWon}
          sub={decided ? `${s.holesHalved} halved · ${s.holesLost} lost` : undefined}
        />
        <StatTile label="Best week" value={fmt(s.bestWeekPoints)} sub="points" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="gap-3">
          <CardHeader>
            <CardTitle>Scoring</CardTitle>
            <CardDescription>{s.holesPlayed} holes played</CardDescription>
          </CardHeader>
          <CardContent>
            <Distribution data={s.distribution} />
          </CardContent>
        </Card>
        <Card className="gap-3">
          <CardHeader>
            <CardTitle>By hole</CardTitle>
            <CardDescription>
              Par 3s {fmt(s.avgByPar[3], 2)} · Par 4s {fmt(s.avgByPar[4], 2)} · Par 5s {fmt(s.avgByPar[5], 2)}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-2 sm:px-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hole</TableHead>
                  {s.avgByHole.map((h) => (
                    <TableHead key={h.hole} className="px-1 text-center">
                      {h.hole}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="text-muted-foreground">Par</TableCell>
                  {s.avgByHole.map((h) => (
                    <TableCell key={h.hole} className="text-muted-foreground px-1 text-center tabular-nums">
                      {h.par}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell>Avg</TableCell>
                  {s.avgByHole.map((h) => (
                    <TableCell
                      key={h.hole}
                      className={cn(
                        "px-1 text-center text-xs tabular-nums",
                        h.avg !== null && h.avg < h.par + 0.5 && "text-primary font-semibold",
                      )}
                    >
                      {fmt(h.avg, 1)}
                    </TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card className="gap-3">
        <CardHeader>
          <CardTitle>Rounds</CardTitle>
        </CardHeader>
        <CardContent className="px-2 sm:px-4">
          {s.roundsList.length === 0 ? (
            <p className="text-muted-foreground px-4 text-sm">No rounds this season yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Wk</TableHead>
                  <TableHead>Opponent</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">Hcp</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                  <TableHead className="text-right">Pts</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {s.roundsList.map((r) => (
                  <TableRow key={r.matchId}>
                    <TableCell className="tabular-nums">{r.weekNumber}</TableCell>
                    <TableCell>
                      <Link href={`/matches/${r.matchId}`} className="hover:underline">
                        {r.opponent?.name ?? "Bye"}
                      </Link>
                      {r.subFor && (
                        <Badge variant="outline" className="ml-2">
                          sub for {r.subFor.name}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(r.gross)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(r.handicap)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(r.net)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {r.points === null ? "–" : `${fmt(r.points)}–${fmt(r.opponentPoints)}`}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
