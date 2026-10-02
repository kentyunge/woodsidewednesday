import { notFound, redirect } from "next/navigation";
import { HttpError } from "@/server/errors";
import { editAccess, getMatch } from "@/server/scores";
import { requirePageActor } from "@/server/session";
import { HoleByHole } from "./hole-by-hole";

export const metadata = { title: "Enter scores" };

/** Hole-by-hole score entry for the course. Sub/absent setup stays on the full match page. */
export default async function PlayPage({ params }: PageProps<"/matches/[id]/play">) {
  const actor = await requirePageActor();
  const id = Number((await params).id);
  const { data, match, week } = await getMatch(id).catch((e) => {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  });
  if (match.bye || !editAccess(actor, match, week).allowed) redirect(`/matches/${id}`);
  return <HoleByHole match={match} holes={data.holes} par={data.par} provisionalPercent={data.rules.provisionalPercent} />;
}
