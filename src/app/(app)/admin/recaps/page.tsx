import Link from "next/link";
import { inArray } from "drizzle-orm";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { seasons } from "@/db/schema";
import { getCurrentSeason } from "@/server/league";
import { getRecapTone, listRecaps, recapRecipients } from "@/server/recap";
import { DEFAULT_TONE } from "@/server/recap/writer";
import { ToneEditor } from "./tone-editor";

export const metadata = { title: "Recaps" };

export default async function RecapsAdminPage() {
  const [tone, recaps, season] = await Promise.all([getRecapTone(), listRecaps(), getCurrentSeason()]);
  const recipients = season ? await recapRecipients(season.id) : { mode: "admins" as const, to: [] };
  const seasonIds = [...new Set(recaps.map((r) => r.seasonId))];
  const seasonNames = seasonIds.length
    ? await db.select({ id: seasons.id, name: seasons.name }).from(seasons).where(inArray(seasons.id, seasonIds))
    : [];

  return (
    <div className="space-y-4">
      <Card className="gap-3">
        <CardHeader>
          <CardTitle>Recap voice</CardTitle>
          <CardDescription>
            Claude writes each week&apos;s recap from the scores. These instructions set its tone. It always judges golfers against
            their own handicap and sticks to what actually happened; the standings table and next week&apos;s matchups are added
            automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ToneEditor tone={tone.tone} isDefault={tone.isDefault} defaultTone={DEFAULT_TONE} />
          <p className="text-muted-foreground text-sm">
            Recaps currently go to{" "}
            {recipients.mode === "admins" ? (
              <>
                <Badge variant="outline">admins only</Badge> ({recipients.to.join(", ") || "none: set ADMIN_EMAILS"}). Set{" "}
                <code>RECAP_SEND_TO=league</code> in Vercel when you&apos;re happy with the tone.
              </>
            ) : (
              <>
                <Badge>the whole league</Badge> ({recipients.to.length} addresses).
              </>
            )}
          </p>
        </CardContent>
      </Card>

      <Card className="gap-3">
        <CardHeader>
          <CardTitle>Recaps</CardTitle>
          <CardDescription>Mark a week complete (or preview a recap) from a season&apos;s Schedule tab.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {recaps.length === 0 ? (
            <p className="text-muted-foreground px-6 text-sm">No recaps yet.</p>
          ) : (
            <div className="divide-y border-y">
              {recaps.map((r) => (
                <Link key={r.id} href={`/admin/recaps/${r.id}`} className="hover:bg-muted/60 flex items-center gap-3 px-6 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{r.subject}</div>
                    <div className="text-muted-foreground text-sm">
                      {seasonNames.find((s) => s.id === r.seasonId)?.name} · Week {r.weekNumber} ·{" "}
                      {r.createdAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </div>
                  </div>
                  <Badge variant={r.sentTo.length ? "secondary" : "outline"}>{r.sentTo.length ? `Sent to ${r.sentTo.length}` : "Preview"}</Badge>
                  <ChevronRight className="text-muted-foreground size-4 shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
