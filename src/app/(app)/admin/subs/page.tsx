import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/dates";
import { listSubs } from "@/server/golfers";
import { getCurrentSeason } from "@/server/league";
import { HandicapStatus } from "../handicap-status";
import { AddSubButton } from "./add-sub";

export const metadata = { title: "Subs" };

export default async function SubsAdminPage() {
  const [subs, season] = await Promise.all([listSubs(), getCurrentSeason()]);
  const rules = season ?? { provisionalPercent: 0.8, establishRounds: 3, handicapPercent: 0.9, rollingRounds: 5 };
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle>Subs</CardTitle>
        <CardDescription>
          Golfers who aren&apos;t regulars{season ? ` in ${season.name}` : ""}. Until a sub has {rules.establishRounds} rounds on record,
          their handicap is {Math.round(rules.provisionalPercent * 100)}% of that night&apos;s round; after that it&apos;s{" "}
          {Math.round(rules.handicapPercent * 100)}% of their last {rules.rollingRounds}. Add previous scores to establish a handicap
          before they play.
        </CardDescription>
        <CardAction>
          <AddSubButton />
        </CardAction>
      </CardHeader>
      <CardContent className="px-0">
        {subs.length === 0 ? (
          <p className="text-muted-foreground px-6 text-sm">No subs yet.</p>
        ) : (
          <div className="divide-y border-y">
            {subs.map((s) => (
              <Link
                key={s.golfer.id}
                href={`/admin/subs/${s.golfer.id}`}
                className="hover:bg-muted/60 flex items-center gap-3 px-6 py-3 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{s.golfer.name}</div>
                  <div className="text-muted-foreground text-sm">
                    {s.rounds} round{s.rounds === 1 ? "" : "s"} on record
                    {s.lastPlayed && ` · last played ${formatDate(s.lastPlayed, { month: "short", day: "numeric", year: "numeric" })}`}
                  </div>
                  <div className="mt-1 sm:hidden">
                    <HandicapStatus handicap={s.handicap} roundsNeeded={s.roundsNeeded} />
                  </div>
                </div>
                <div className="hidden sm:block">
                  <HandicapStatus handicap={s.handicap} roundsNeeded={s.roundsNeeded} />
                </div>
                <ChevronRight className="text-muted-foreground size-4 shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
