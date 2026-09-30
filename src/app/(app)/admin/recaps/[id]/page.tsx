import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { eq } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { db } from "@/db";
import { weeks } from "@/db/schema";
import { HttpError } from "@/server/errors";
import { getRecap } from "@/server/recap";

export const metadata = { title: "Recap" };

export default async function RecapPage({ params }: PageProps<"/admin/recaps/[id]">) {
  const recap = await getRecap(Number((await params).id)).catch((e) => {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  });
  const [week] = await db.select().from(weeks).where(eq(weeks.id, recap.weekId));
  return (
    <div className="space-y-3">
      <Link href="/admin/recaps" className="text-muted-foreground inline-flex items-center gap-1 text-sm hover:underline">
        <ArrowLeft className="size-4" /> Recaps
      </Link>
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">{recap.subject}</h2>
        <p className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
          Week {week?.number} · written by {recap.model} ·{" "}
          {recap.sentTo.length ? `sent to ${recap.sentTo.join(", ")}` : <Badge variant="outline">Preview, not sent</Badge>}
          {week && (
            <Link href={`/admin/seasons/${week.seasonId}/schedule`} className="underline">
              Resend or preview another from the schedule
            </Link>
          )}
        </p>
      </div>
      {/* Rendered exactly as emailed, sandboxed so its HTML can't touch the app. */}
      <iframe title="Recap email" srcDoc={recap.html} sandbox="" className="h-[80vh] w-full rounded-lg border bg-white" />
    </div>
  );
}
