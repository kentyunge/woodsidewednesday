import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/dates";
import { listSeasonSummaries } from "@/server/admin";
import { ImportSeasonButton } from "./import-season";
import { NewSeasonButton } from "./new-season";

export const metadata = { title: "Admin" };

export default async function AdminSeasonsPage() {
  const seasons = await listSeasonSummaries();
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle>Seasons</CardTitle>
        <CardDescription>Pick a season to manage its details, players and schedule.</CardDescription>
        <CardAction className="flex gap-2">
          <ImportSeasonButton />
          <NewSeasonButton />
        </CardAction>
      </CardHeader>
      <CardContent className="px-0">
        {seasons.length === 0 ? (
          <p className="text-muted-foreground px-6 text-sm">No seasons yet. Create one to get started.</p>
        ) : (
          <div className="divide-y border-y">
            {seasons.map(({ season: s, players, weeks, scores }) => (
              <Link
                key={s.id}
                href={`/admin/seasons/${s.id}`}
                className="hover:bg-muted/60 flex items-center gap-3 px-6 py-3 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 font-medium">
                    <span className="truncate">{s.name}</span>
                    <Badge variant={s.status === "active" ? "default" : "secondary"}>{s.status}</Badge>
                  </div>
                  <div className="text-muted-foreground text-sm">
                    Starts {formatDate(s.startDate, { month: "short", day: "numeric", year: "numeric" })} · {players} players ·{" "}
                    {weeks} weeks · {scores} cards entered
                  </div>
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
