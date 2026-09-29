import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { eq } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { db } from "@/db";
import { seasons } from "@/db/schema";
import { SeasonTabs } from "./season-tabs";

export default async function SeasonAdminLayout({ children, params }: LayoutProps<"/admin/seasons/[id]">) {
  const id = Number((await params).id);
  const [season] = Number.isInteger(id) ? await db.select().from(seasons).where(eq(seasons.id, id)) : [];
  if (!season) notFound();
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Link href="/admin" className="text-muted-foreground inline-flex items-center gap-1 text-sm hover:underline">
          <ArrowLeft className="size-4" /> All seasons
        </Link>
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          {season.name}
          <Badge variant={season.status === "active" ? "default" : "secondary"}>{season.status}</Badge>
        </h2>
      </div>
      <SeasonTabs seasonId={season.id} />
      {children}
    </div>
  );
}
