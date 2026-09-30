import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Scorecard, StrokeSummary } from "@/components/league/scorecard";
import { formatDate } from "@/lib/dates";
import { fmt } from "@/lib/utils";
import { HttpError } from "@/server/errors";
import { editAccess, getMatch, ghostCandidates } from "@/server/scores";
import { requirePageActor } from "@/server/session";
import { ScoreEntry } from "./score-entry";

export default async function MatchPage({ params }: PageProps<"/matches/[id]">) {
  const actor = await requirePageActor();
  const id = Number((await params).id);
  const loaded = await getMatch(id).catch((e) => {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  });
  const { data, match, week } = loaded;
  const access = editAccess(actor, match, week);
  const r = match.result;
  const inMatch = new Set([match.a.owner.id, match.b?.owner.id]);
  const subOptions = [...data.golfers.values()]
    .filter((g) => g.active && !inMatch.has(g.id))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((g) => ({ id: g.id, name: g.name, isSub: g.isSub }));

  return (
    <div className="space-y-4">
      <Link href={`/schedule?season=${data.season.id}`} className="text-muted-foreground inline-flex items-center gap-1 text-sm hover:underline">
        <ArrowLeft className="size-4" /> Schedule
      </Link>
      <Card className="gap-3">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2 text-xl">
            {match.a.owner.name} <span className="text-muted-foreground font-normal">vs</span> {match.b?.owner.name ?? "Bye"}
          </CardTitle>
          <CardDescription className="flex flex-wrap items-center gap-2">
            Week {week.number} · {formatDate(week.date, { weekday: "long", month: "long", day: "numeric" })}
            {week.kind === "position" && <Badge>Position night</Badge>}
            {match.complete && !match.bye && <Badge variant="secondary">Final</Badge>}
          </CardDescription>
        </CardHeader>
        {r && match.b && (
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-center">
              {(["a", "b"] as const).map((k) => (
                <div key={k} className="bg-muted/50 rounded-lg p-3">
                  <div className="truncate text-sm font-medium">{match[k]!.owner.name}</div>
                  <div className="text-3xl font-bold tabular-nums">
                    {match[k]!.status === "ghost" && r.complete ? 0 : fmt(r[k].points)}
                  </div>
                  <div className="text-muted-foreground text-xs">points</div>
                </div>
              ))}
            </div>
            <StrokeSummary match={match} />
          </CardContent>
        )}
      </Card>

      <Scorecard match={match} holes={data.holes} />

      {access.allowed ? (
        <ScoreEntry
          match={match}
          holes={data.holes}
          par={data.par}
          provisionalPercent={data.rules.provisionalPercent}
          isAdmin={access.admin}
          subOptions={subOptions}
          ghostOptions={ghostCandidates(data, match)}
          lockDate={week.lockDate}
        />
      ) : (
        !match.bye && (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <Lock className="size-4" /> {access.reason}
          </p>
        )
      )}
    </div>
  );
}
