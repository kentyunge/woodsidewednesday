import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/dates";
import { fmt } from "@/lib/utils";
import { HttpError } from "@/server/errors";
import { golferRounds } from "@/server/golfers";
import { HandicapStatus } from "../../handicap-status";
import { AddPreviousScores, DeleteRound, GolferContact, SubToggle } from "./golfer-admin";

/** Admin view of one golfer: handicap, contact, previous scores. Shared by /admin/golfers/[id] and /admin/subs/[id]. */
export async function GolferAdminView({ id, back }: { id: number; back: "golfers" | "subs" }) {
  const view = await golferRounds(id).catch((e) => {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  });
  const { golfer, handicap, roundsNeeded, rules, rounds } = view;
  const basisCount = handicap.basis.length;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Link href={`/admin/${back}`} className="text-muted-foreground inline-flex items-center gap-1 text-sm hover:underline">
          <ArrowLeft className="size-4" /> {back === "subs" ? "Subs" : "Golfers"}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            {golfer.name}
            <Badge variant="secondary">{golfer.isSub ? "Sub" : "Regular"}</Badge>
            {!golfer.active && <Badge variant="outline">Archived</Badge>}
          </h2>
          <SubToggle golfer={{ id: golfer.id, name: golfer.name, isSub: golfer.isSub }} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="gap-3">
          <CardHeader>
            <CardTitle>Handicap</CardTitle>
            <CardDescription>Going into their next round.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <HandicapStatus handicap={handicap} roundsNeeded={roundsNeeded} />
            {handicap.method === "rolling" ? (
              <p className="text-muted-foreground">
                {Math.round(rules.percent * 100)}% of the average of their last {basisCount} round{basisCount === 1 ? "" : "s"} (
                {handicap.basis.map((d) => (d > 0 ? `+${d}` : d)).join(", ")} over par) = {fmt(handicap.raw, 2)}, rounded to{" "}
                {fmt(handicap.handicap)}.
              </p>
            ) : (
              <p className="text-muted-foreground">
                Until they have {rules.establishRounds} rounds on record, their handicap each night is{" "}
                {Math.round(rules.provisionalPercent * 100)}% of that night&apos;s strokes over par. Add previous scores below to
                establish it now.
              </p>
            )}
          </CardContent>
        </Card>

        <GolferContact golfer={{ id: golfer.id, name: golfer.name, email: golfer.email, phone: golfer.phone }} />
      </div>

      <AddPreviousScores golferId={golfer.id} />

      <Card className="gap-3">
        <CardHeader>
          <CardTitle>Rounds on record ({rounds.length})</CardTitle>
          <CardDescription>
            The most recent {rules.rollingRounds} count toward the handicap. Previous scores can be deleted; league rounds are edited on
            their scorecard.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-2 sm:px-4">
          {rounds.length === 0 ? (
            <p className="text-muted-foreground px-4 text-sm">No rounds yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead className="text-right">+/-</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rounds.map((r, i) => (
                  <TableRow
                    key={`${r.source}-${r.matchId ?? r.historicalId}`}
                    className={i < rules.rollingRounds ? "" : "text-muted-foreground"}
                  >
                    <TableCell className="tabular-nums">{formatDate(r.date, { month: "short", day: "numeric", year: "numeric" })}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{r.gross}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.diff > 0 ? `+${r.diff}` : r.diff}</TableCell>
                    <TableCell>
                      {r.source === "match" ? (
                        <Link href={`/matches/${r.matchId}`} className="hover:underline">
                          {r.seasonName} · Week {r.weekNumber}
                        </Link>
                      ) : (
                        <span>{r.note || "Previous score"}</span>
                      )}
                    </TableCell>
                    <TableCell>{r.historicalId && <DeleteRound id={r.historicalId} />}</TableCell>
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
