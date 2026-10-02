import { InstallPrompt } from "@/components/layout/install-prompt";
import { BottomTabs, Nav } from "@/components/layout/nav";
import { requirePageActor } from "@/server/session";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const actor = await requirePageActor();
  return (
    <>
      <Nav name={actor.name} isAdmin={actor.isAdmin} hasGolfer={actor.golferId !== null} />
      {/* On phones, leave room for the bottom tab bar and the home indicator. */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-3 pt-4 pb-[calc(5rem+env(safe-area-inset-bottom))] sm:px-4 sm:pt-6 md:pb-6">
        <InstallPrompt />
        {children}
      </main>
      <BottomTabs isAdmin={actor.isAdmin} hasGolfer={actor.golferId !== null} />
    </>
  );
}
