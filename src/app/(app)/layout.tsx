import { Nav } from "@/components/layout/nav";
import { requirePageActor } from "@/server/session";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const actor = await requirePageActor();
  return (
    <>
      <Nav name={actor.name} isAdmin={actor.isAdmin} hasGolfer={actor.golferId !== null} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-3 py-4 sm:px-4 sm:py-6">{children}</main>
    </>
  );
}
