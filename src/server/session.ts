import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getActor } from "./access";
import { getCurrentSeason, getSeasons, loadSeason } from "./league";

export const getPageActor = cache(async () => getActor(await headers()));

export async function requirePageActor() {
  const actor = await getPageActor();
  if (!actor) redirect("/login");
  return actor;
}

export async function requirePageAdmin() {
  const actor = await requirePageActor();
  if (!actor.isAdmin) redirect("/");
  return actor;
}

/** Season from `?season=` or the current one. */
export const resolveSeason = cache(async (param?: string | string[]) => {
  const id = Number(Array.isArray(param) ? param[0] : param);
  const seasons = await getSeasons();
  const season = (id && seasons.find((s) => s.id === id)) || (await getCurrentSeason());
  return { seasons, season: season ?? null, data: season ? await loadSeason(season.id) : null };
});
