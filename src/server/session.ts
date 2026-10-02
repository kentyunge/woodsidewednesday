import { cookies, headers } from "next/headers";
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

/** Cookie holding the season last picked in the season dropdown (set by SeasonPicker). */
export const SEASON_COOKIE = "season";

/** Season from `?season=`, else the one last picked in the dropdown, else the current one. */
export const resolveSeason = cache(async (param?: string | string[]) => {
  const fromUrl = Number(Array.isArray(param) ? param[0] : param);
  const remembered = Number((await cookies()).get(SEASON_COOKIE)?.value);
  const seasons = await getSeasons();
  const find = (id: number) => (id ? seasons.find((s) => s.id === id) : undefined);
  const season = find(fromUrl) ?? find(remembered) ?? (await getCurrentSeason());
  return { seasons, season: season ?? null, data: season ? await loadSeason(season.id) : null };
});
