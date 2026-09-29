import { notFound } from "next/navigation";
import { listSeasonSummaries } from "@/server/admin";
import { SeasonDetails } from "./season-details";

export const metadata = { title: "Season" };

export default async function SeasonDetailsPage({ params }: PageProps<"/admin/seasons/[id]">) {
  const id = Number((await params).id);
  const summary = (await listSeasonSummaries()).find((s) => s.season.id === id);
  if (!summary) notFound();
  return <SeasonDetails season={summary.season} players={summary.players} weeks={summary.weeks} scores={summary.scores} />;
}
