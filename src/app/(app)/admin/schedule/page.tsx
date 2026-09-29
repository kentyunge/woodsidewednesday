import { redirect } from "next/navigation";
import { getCurrentSeason } from "@/server/league";

/** Old location of the schedule editor; it now lives under each season. */
export default async function ScheduleAdminRedirect({ searchParams }: PageProps<"/admin/schedule">) {
  const id = Number((await searchParams).season) || (await getCurrentSeason())?.id;
  redirect(id ? `/admin/seasons/${id}/schedule` : "/admin");
}
